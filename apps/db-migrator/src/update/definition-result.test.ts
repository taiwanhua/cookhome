import { describe, expect, it } from "@jest/globals";

import type {
  DefinitionSeedItemResult,
  DefinitionSeedOperation,
  DefinitionSeedSet,
} from "@repo/domain/seed";

import { definitionHashesOf } from "./content-hash";
import {
  DefinitionSeedCliError,
  matchDefinitionSeedResult,
} from "./definition-result";

/**
 * 受管定義 CLI 的輸出驗收:完整結果要逐筆對回請求,少項、重項、假成功、子程序錯誤都不能被記成成功。
 * (真的子程序在 `update-upgrade.test.ts` / `update-resume.test.ts`。)
 */

function workflow(key: string, revision = "r1"): DefinitionSeedSet {
  return {
    kind: "workflow-definition",
    key,
    revision,
    name: `流程 ${key}`,
    changelog: revision,
    desiredStatus: "published",
    checkFormKey: null,
    definition: {
      steps: [
        {
          key: "boss",
          name: "主管",
          assignee: { kind: "manager", level: 1 },
          mode: "any",
        },
      ],
    },
  };
}

function installed(
  seed: DefinitionSeedSet,
  overrides: Partial<DefinitionSeedItemResult> = {},
): DefinitionSeedItemResult {
  return {
    kind: seed.kind,
    key: seed.key,
    revision: seed.revision,
    ...definitionHashesOf(seed),
    definitionId: "0000000000000000000000a1",
    localVersion: 1,
    outcome: "created",
    conflict: null,
    ...overrides,
  };
}

const FIRST = workflow("result_first");
const SECOND = workflow("result_second");

function match(
  results: unknown[],
  options: {
    operation?: DefinitionSeedOperation;
    status?: number | null;
    errors?: unknown[];
    stderr?: string;
  } = {},
) {
  const { operation = "apply", status = 0, errors = [], stderr = "" } = options;
  return matchDefinitionSeedResult(
    { operation, seeds: [FIRST, SECOND] },
    { status, stdout: `${JSON.stringify({ results, errors })}\n`, stderr },
  );
}

describe("matchDefinitionSeedResult", () => {
  it("每一筆都對回請求且已安裝:回同一順序的結果", () => {
    const results = [
      installed(FIRST),
      installed(SECOND, { localVersion: 4, outcome: "updated" }),
    ];
    expect(match(results)).toEqual(results);
  });

  it("inspect 可以回尚未安裝(absent),一樣要逐筆對回請求", () => {
    const results = [
      installed(FIRST, { outcome: "unchanged", currentVersion: 1 }),
      installed(SECOND, {
        outcome: "absent",
        definitionId: null,
        localVersion: null,
        currentVersion: null,
        currentContentHash: null,
      }),
    ];
    expect(match(results, { operation: "inspect" })).toEqual(results);
  });

  it("少一筆:失敗(不會把沒回報的當成已完成)", () => {
    expect(() => match([installed(FIRST)])).toThrow(
      "workflow-definition:result_second@r1 沒有回報結果",
    );
    expect(() => match([])).toThrow(DefinitionSeedCliError);
  });

  it("同一筆回報兩次、回報了請求裡沒有的、順序不同:失敗", () => {
    expect(() => match([installed(FIRST), installed(FIRST)])).toThrow(
      "workflow-definition:result_first@r1 重複回報",
    );
    expect(() =>
      match([installed(FIRST), installed(workflow("result_other"))]),
    ).toThrow("回報了請求裡沒有的 workflow-definition:result_other@r1");
    expect(() => match([installed(SECOND), installed(FIRST)])).toThrow(
      "的順序與請求不同",
    );
  });

  it("同一個 key 但 revision 或 hash 對不上送出的宣告:失敗", () => {
    expect(() =>
      match([installed(FIRST), installed(workflow("result_second", "r2"))]),
    ).toThrow("回報了請求裡沒有的 workflow-definition:result_second@r2");
    expect(() =>
      match([
        installed(FIRST),
        installed(SECOND, { contentHash: `sha256:${"0".repeat(64)}` }),
      ]),
    ).toThrow("回報的 hash 與送出的宣告不同");
  });

  it("假成功:結束碼 0 但某一筆其實是衝突、沒有映射、或 apply 回了 absent → 失敗", () => {
    expect(() =>
      match([
        installed(FIRST),
        installed(SECOND, {
          outcome: null,
          conflict: { code: "CONTENT_MISMATCH", message: "內容不同" },
        }),
      ]),
    ).toThrow("內容不同(CONTENT_MISMATCH)");
    // 完成結果卻沒有映射:協定層就不接受
    expect(() =>
      match([installed(FIRST), installed(SECOND, { localVersion: null })]),
    ).toThrow("的輸出不是合法的結果");
    expect(() =>
      match([
        installed(FIRST),
        installed(SECOND, { outcome: "absent", localVersion: null }),
      ]),
    ).toThrow("的輸出不是合法的結果");
  });

  it("子程序錯誤:非零結束、errors、不是 JSON、空輸出 → 失敗,並附上子程序的診斷", () => {
    const complete = [installed(FIRST), installed(SECOND)];
    expect(() => match(complete, { status: 1 })).toThrow("以 exit 1 結束");
    expect(() => match(complete, { status: null })).toThrow(
      "以 exit null 結束",
    );
    expect(() =>
      match([], {
        status: 1,
        errors: [{ code: "LOCK_OWNER_MISMATCH", message: "鎖不是這次請求的" }],
        stderr: "stack trace here",
      }),
    ).toThrow(/鎖不是這次請求的\(LOCK_OWNER_MISMATCH\)[\s\S]*stack trace here/);
    for (const stdout of ["", "not json", "{}", '{"results":[]}']) {
      expect(() =>
        matchDefinitionSeedResult(
          { operation: "apply", seeds: [FIRST] },
          { status: 0, stdout, stderr: "boot failed" },
        ),
      ).toThrow(/的輸出不是合法的結果[\s\S]*boot failed/);
    }
  });
});
