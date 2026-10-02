import { createHash } from "node:crypto";

import { describe, expect, it } from "@jest/globals";

import { field } from "../form/form-test-support";
import type { WorkflowDefinition } from "../workflow/types";
import { review } from "../workflow/workflow-test-support";
import {
  SeedSerializationError,
  assertPureSeedData,
  canonicalJson,
  hashDefinitionSeed,
} from "./canonical";
import type { DefinitionSeedSet, SeedSet } from "./declaration";
import { validatePortableDefinition } from "./portable-definition";
import { catalogOf, formSeed, workflowSeed } from "./seed-test-support";
import { serializeSeedSet } from "./serialize";

/**
 * 種子的純資料邊界:hash、匯出與檢查在讀任何值之前都先過同一關,
 * 陣列空洞、循環引用、accessor 不會被悄悄略過或讀出不一致的值。
 */

const sha256Hex = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

function documentsWith(value: unknown): SeedSet {
  return {
    kind: "documents",
    collection: "seed_fixture_items",
    entries: [{ key: "item", data: { value } }],
  };
}

/** 丟出的 `SeedSerializationError` 的位置;沒丟、或丟的是別種錯(如 RangeError)都讓測試失敗。 */
function errorPathOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof SeedSerializationError) {
      return error.path;
    }
    throw error;
  }
  throw new Error("預期被純資料邊界拒絕,但通過了");
}

/** 想蓋掉陣列內建 `map` 的替身:若被呼叫,輸出內容就會被換成它回的東西。 */
function injected(): string[] {
  return ['"injected"'];
}

/** `[<空洞>, 1]`:長度 2、索引 0 沒有元素。 */
function arrayWithHole(): unknown[] {
  const sparse: unknown[] = [];
  sparse[1] = 1;
  return sparse;
}

describe("純資料邊界", () => {
  it("空陣列與正常陣列通過;有空洞的陣列逐索引拒絕並指出位置(不會變成空陣列或缺元素)", () => {
    expect(canonicalJson([])).toBe("[]");
    expect(canonicalJson([null, 1])).toBe("[null,1]");
    // 長度 1、沒有任何元素
    const onlyHole: unknown[] = [];
    onlyHole.length = 1;
    expect(errorPathOf(() => canonicalJson(onlyHole))).toBe("0");
    expect(errorPathOf(() => canonicalJson({ list: arrayWithHole() }))).toBe(
      "list.0",
    );
    expect(
      errorPathOf(() => serializeSeedSet(documentsWith(arrayWithHole()))),
    ).toBe("entries.0.data.value.0");
  });

  it("循環引用丟 SeedSerializationError 並指出成圈的位置(不是 RangeError);不成圈的共用子物件通過", () => {
    const cyclic: Record<string, unknown> = { name: "a" };
    cyclic.self = { back: cyclic };
    expect(errorPathOf(() => canonicalJson(cyclic))).toBe("self.back");
    expect(errorPathOf(() => serializeSeedSet(documentsWith(cyclic)))).toBe(
      "entries.0.data.value.self.back",
    );

    const shared = { provider: "user", labelField: "name" };
    const reused = { first: shared, second: shared, list: [shared, shared] };
    expect(canonicalJson(reused)).toBe(
      '{"first":{"labelField":"name","provider":"user"},"list":[{"labelField":"name","provider":"user"},{"labelField":"name","provider":"user"}],"second":{"labelField":"name","provider":"user"}}',
    );
    expect(() => serializeSeedSet(documentsWith(reused))).not.toThrow();
  });

  it("accessor 一律拒絕且不被執行:hash 與匯出不會各自讀到不同的值", () => {
    let reads = 0;
    const seed = formSeed([field("title", "text")]);
    Object.defineProperty(seed, "name", {
      enumerable: true,
      get() {
        reads += 1;
        return `請假單 ${String(reads)}`;
      },
    });
    expect(errorPathOf(() => hashDefinitionSeed(seed, sha256Hex))).toBe("name");
    expect(errorPathOf(() => serializeSeedSet(seed))).toBe("name");
    expect(
      validatePortableDefinition(seed, catalogOf()).errors.map((issue) => [
        issue.code,
        issue.path,
      ]),
    ).toEqual([["SEED_SHAPE", "name"]]);
    expect(reads).toBe(0);

    // 藏在深處的 accessor 同樣指出位置;setter-only 也算
    const nested = formSeed([field("title", "text")]);
    Object.defineProperty(nested.definition.fields[0], "label", {
      enumerable: true,
      set() {
        reads += 1;
      },
    });
    expect(
      errorPathOf(() => {
        assertPureSeedData(nested);
      }),
    ).toBe("definition.fields.0.label");
    expect(reads).toBe(0);
  });

  it("不可列舉的 getter 也拒絕且不執行:兩次 hash 不會因為各讀一次而不同", () => {
    let reads = 0;
    const seed = workflowSeed();
    Object.defineProperty(seed, "name", {
      enumerable: false,
      get() {
        reads += 1;
        return `Sample ${String(reads)}`;
      },
    });
    expect(errorPathOf(() => hashDefinitionSeed(seed, sha256Hex))).toBe("name");
    expect(errorPathOf(() => hashDefinitionSeed(seed, sha256Hex))).toBe("name");
    expect(errorPathOf(() => serializeSeedSet(seed))).toBe("name");
    expect(
      validatePortableDefinition(seed, catalogOf()).errors.map((issue) => [
        issue.code,
        issue.path,
      ]),
    ).toEqual([["SEED_SHAPE", "name"]]);
    expect(reads).toBe(0);

    // 不可列舉的資料屬性:列舉看不到、直接讀又讀得到,同樣不收
    const hidden = workflowSeed();
    Object.defineProperty(hidden, "name", {
      enumerable: false,
      value: "藏起來的名稱",
    });
    expect(errorPathOf(() => hashDefinitionSeed(hidden, sha256Hex))).toBe(
      "name",
    );
  });

  it("陣列自有的 map(accessor 或函式)不會被呼叫,內容不能被換掉;其他非索引屬性、symbol 鍵、換掉的原型都拒絕", () => {
    let reads = 0;
    const withAccessor = [1];
    Object.defineProperty(withAccessor, "map", {
      enumerable: true,
      get() {
        reads += 1;
        return injected;
      },
    });
    const withFunction = [1];
    Object.defineProperty(withFunction, "map", {
      enumerable: false,
      value: () => {
        reads += 1;
        return injected();
      },
    });
    for (const values of [withAccessor, withFunction]) {
      expect(
        errorPathOf(() => {
          assertPureSeedData({ values });
        }),
      ).toBe("values.map");
      expect(errorPathOf(() => canonicalJson({ values }))).toBe("values.map");
      expect(errorPathOf(() => serializeSeedSet(documentsWith(values)))).toBe(
        "entries.0.data.value.map",
      );
    }
    expect(reads).toBe(0);

    const withExtra = Object.assign([1], { note: "x" });
    expect(errorPathOf(() => canonicalJson(withExtra))).toBe("note");
    const withSymbol = { a: 1, [Symbol("hidden")]: 2 };
    expect(errorPathOf(() => canonicalJson(withSymbol))).toBe("Symbol(hidden)");
    const reparented = [1];
    Object.setPrototypeOf(reparented, { map: injected });
    expect(errorPathOf(() => canonicalJson({ reparented }))).toBe("reparented");
  });

  it("合法資料的 hash 與匯出前後一致:同一份宣告重複計算、重複匯出結果相同", () => {
    const seed = workflowSeed({
      steps: [review("boss"), review("hr")],
      edges: [{ from: "boss", to: "hr" }],
    });
    expect(hashDefinitionSeed(seed, sha256Hex)).toEqual(
      hashDefinitionSeed(seed, sha256Hex),
    );
    expect(serializeSeedSet(seed)).toBe(serializeSeedSet(seed));
    expect(canonicalJson([1, [2, [3]], { list: [] }])).toBe(
      '[1,[2,[3]],{"list":[]}]',
    );
  });

  it("一般的純物件(含值為 undefined 的鍵、沒有原型的物件)照常通過", () => {
    const bare = Object.assign(Object.create(null) as object, { a: 1 });
    expect(canonicalJson({ bare, skipped: undefined })).toBe(
      '{"bare":{"a":1}}',
    );
    const seed = formSeed([field("title", "text")]);
    expect(() => hashDefinitionSeed(seed, sha256Hex)).not.toThrow();
  });
});

describe("流程 edges 的正規化只收斂明訂等價的寫法", () => {
  const steps = [review("boss"), review("hr")];
  const withEdges = (edges: unknown): DefinitionSeedSet =>
    workflowSeed({ steps, edges } as unknown as WorkflowDefinition);

  it("缺席、null、空陣列相同;誤寫成物件等無效值不會被當成「沒有連線」", () => {
    const linear = hashDefinitionSeed(workflowSeed({ steps }), sha256Hex);
    expect(hashDefinitionSeed(withEdges(null), sha256Hex)).toEqual(linear);
    expect(hashDefinitionSeed(withEdges([]), sha256Hex)).toEqual(linear);
    for (const invalid of [{}, "boss->hr", 0, false]) {
      const hashes = hashDefinitionSeed(withEdges(invalid), sha256Hex);
      expect(hashes.contentHash).not.toBe(linear.contentHash);
      expect(hashes.snapshotHash).not.toBe(linear.snapshotHash);
    }
    // 無效的 edges 由形狀檢查擋下,不是靠 hash 悄悄吃掉
    expect(
      validatePortableDefinition(withEdges({}), catalogOf()).errors.map(
        (issue) => [issue.code, issue.path],
      ),
    ).toEqual([["SEED_SHAPE", "definition.edges"]]);
  });
});
