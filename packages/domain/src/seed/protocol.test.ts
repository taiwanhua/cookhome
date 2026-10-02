import { describe, expect, it } from "@jest/globals";

import { field } from "../form/form-test-support";
import {
  DEFINITION_SEED_PROTOCOL_VERSION,
  DefinitionSeedProtocolError,
  type DefinitionSeedRequest,
  type DefinitionSeedResult,
  isDefinitionInstalled,
  isDefinitionSeedResultOk,
  parseDefinitionSeedRequest,
  parseDefinitionSeedResult,
} from "./protocol";
import { formSeed, workflowSeed } from "./seed-test-support";

const HASH = `sha256:${"a".repeat(64)}`;

function request(
  overrides: Partial<Record<keyof DefinitionSeedRequest, unknown>> = {},
): unknown {
  return {
    protocolVersion: DEFINITION_SEED_PROTOCOL_VERSION,
    runId: "run-1",
    lockOwner: "owner-token",
    releaseCommit: "0123abc",
    operation: "apply",
    seeds: [formSeed([field("title", "text")]), workflowSeed()],
    ...overrides,
  };
}

function result(
  item: Record<string, unknown> = {},
  errors: unknown[] = [],
): unknown {
  return {
    results: [
      {
        kind: "form-definition",
        key: "leave_request",
        revision: "r1",
        contentHash: HASH,
        snapshotHash: HASH,
        definitionId: "64f000000000000000000001",
        localVersion: 2,
        outcome: "created",
        conflict: null,
        ...item,
      },
    ],
    errors,
  };
}

describe("DefinitionSeedRequest", () => {
  it("經過 JSON 來回後照樣解析成同一份請求", () => {
    // stdin 實際收到的是文字:先轉成 JSON 文字再讀回來
    const wire = JSON.stringify(request());
    const parsed = parseDefinitionSeedRequest(JSON.parse(wire));
    expect(parsed).toEqual(request());
    expect(parsed.seeds.map((seed) => seed.kind)).toEqual([
      "form-definition",
      "workflow-definition",
    ]);
  });

  it("協定版本不符、缺欄位、未知操作:拒絕並指出是哪一項", () => {
    expect(() =>
      parseDefinitionSeedRequest(request({ protocolVersion: 2 })),
    ).toThrow(DefinitionSeedProtocolError);
    expect(() =>
      parseDefinitionSeedRequest(request({ lockOwner: "" })),
    ).toThrow("lockOwner");
    expect(() =>
      parseDefinitionSeedRequest(request({ operation: "publish" })),
    ).toThrow("operation");
    expect(() =>
      parseDefinitionSeedRequest(request({ releaseCommit: undefined })),
    ).toThrow("releaseCommit");
  });

  it("任何一份宣告形狀不對就整批拒絕(指出第幾份的哪個位置)", () => {
    expect(() =>
      parseDefinitionSeedRequest(
        request({
          seeds: [
            workflowSeed(),
            formSeed([field("title", "text")], { revision: "Bad Revision" }),
          ],
        }),
      ),
    ).toThrow("seeds.1.revision");
    expect(() =>
      parseDefinitionSeedRequest(
        request({ seeds: [{ kind: "documents", collection: "forms" }] }),
      ),
    ).toThrow("seeds.0.kind");
  });
});

const CONFLICT = {
  code: "REVISION_HASH_MISMATCH",
  message: "同 revision 異內容",
};

describe("DefinitionSeedResult", () => {
  it("apply:完成結果帶實際的定義 id 與正整數版號;每筆恰好有處理結果或衝突其中之一", () => {
    const parsed = parseDefinitionSeedResult(result(), "apply");
    expect(parsed.results[0]).toMatchObject({
      outcome: "created",
      conflict: null,
      definitionId: "64f000000000000000000001",
      localVersion: 2,
    });
    expect(isDefinitionSeedResultOk(parsed)).toBe(true);
    expect(parsed.results.every((item) => isDefinitionInstalled(item))).toBe(
      true,
    );
    expect(() =>
      parseDefinitionSeedResult(result({ outcome: null }), "apply"),
    ).toThrow("outcome 或 conflict");
    expect(() =>
      parseDefinitionSeedResult(result({ conflict: CONFLICT }), "apply"),
    ).toThrow("outcome 或 conflict");
  });

  it("完成結果卻沒有映射、版號不是正整數:拒絕(不能把不完整的映射當成成功)", () => {
    for (const outcome of ["created", "updated", "adopted", "unchanged"]) {
      expect(() =>
        parseDefinitionSeedResult(
          result({ outcome, definitionId: null, localVersion: null }),
          "apply",
        ),
      ).toThrow("必須有 definitionId 與 localVersion");
      expect(() =>
        parseDefinitionSeedResult(
          result({ outcome, localVersion: null }),
          "apply",
        ),
      ).toThrow("必須有 definitionId 與 localVersion");
    }
    for (const localVersion of [-1, 0, 1.5, "3"]) {
      expect(() =>
        parseDefinitionSeedResult(result({ localVersion }), "apply"),
      ).toThrow("localVersion 必須是正整數");
    }
    expect(() =>
      parseDefinitionSeedResult(result({ definitionId: "  " }), "apply"),
    ).toThrow("definitionId");
  });

  it("inspect:已安裝回 unchanged 與映射;尚未安裝明確回 absent(不是成功、也不是失敗),附加欄位照驗", () => {
    const installed = parseDefinitionSeedResult(
      result({
        outcome: "unchanged",
        currentVersion: 2,
        currentContentHash: HASH,
      }),
      "inspect",
    );
    expect(installed.results[0]).toMatchObject({
      outcome: "unchanged",
      localVersion: 2,
      currentVersion: 2,
      currentContentHash: HASH,
    });

    // 身分還不存在
    const missing = parseDefinitionSeedResult(
      result({
        outcome: "absent",
        definitionId: null,
        localVersion: null,
        currentVersion: null,
        currentContentHash: null,
      }),
      "inspect",
    );
    // 身分已存在、但這個 revision 還沒裝(目前發布的是別的內容)
    const otherRevision = parseDefinitionSeedResult(
      result({
        outcome: "absent",
        localVersion: null,
        currentVersion: 5,
        currentContentHash: HASH,
      }),
      "inspect",
    );
    for (const parsed of [missing, otherRevision]) {
      expect(isDefinitionSeedResultOk(parsed)).toBe(true);
      expect(parsed.results.some((item) => isDefinitionInstalled(item))).toBe(
        false,
      );
    }
    expect(otherRevision.results[0]?.definitionId).toBe(
      "64f000000000000000000001",
    );

    expect(() =>
      parseDefinitionSeedResult(result({ outcome: "absent" }), "inspect"),
    ).toThrow("absent(尚未安裝)時 localVersion 必須是 null");
    expect(() =>
      parseDefinitionSeedResult(
        result({ outcome: "unchanged", currentVersion: 0 }),
        "inspect",
      ),
    ).toThrow("currentVersion 必須是正整數");
  });

  it("兩種操作能回報的結果不同:inspect 不會新增 / 更新 / 採納,apply 不會回 absent", () => {
    for (const outcome of ["created", "updated", "adopted"]) {
      expect(() =>
        parseDefinitionSeedResult(result({ outcome }), "inspect"),
      ).toThrow("outcome 必須是 unchanged / absent");
    }
    expect(() =>
      parseDefinitionSeedResult(
        result({ outcome: "absent", definitionId: null, localVersion: null }),
        "apply",
      ),
    ).toThrow("outcome 必須是 created / updated / adopted / unchanged");
  });

  it("有衝突或任何 errors 就不算成功(exit 0 不能掩蓋未解衝突);衝突時映射可以還沒有", () => {
    const conflicted = parseDefinitionSeedResult(
      result({
        outcome: null,
        conflict: CONFLICT,
        definitionId: null,
        localVersion: null,
      }),
      "apply",
    );
    expect(isDefinitionSeedResultOk(conflicted)).toBe(false);
    expect(conflicted.results.some((item) => isDefinitionInstalled(item))).toBe(
      false,
    );
    const failed = parseDefinitionSeedResult(
      result({}, [{ code: "NO_OPERATOR", message: "找不到適用的操作者" }]),
      "apply",
    );
    expect(isDefinitionSeedResultOk(failed)).toBe(false);
  });

  it("格式不符(hash、未知結果、缺 errors)一律拒絕", () => {
    expect(() =>
      parseDefinitionSeedResult(result({ contentHash: "abc" }), "apply"),
    ).toThrow("contentHash");
    expect(() =>
      parseDefinitionSeedResult(result({ outcome: "skipped" }), "apply"),
    ).toThrow("outcome");
    expect(() =>
      parseDefinitionSeedResult(
        { results: [] } satisfies Partial<DefinitionSeedResult>,
        "apply",
      ),
    ).toThrow("errors");
  });
});
