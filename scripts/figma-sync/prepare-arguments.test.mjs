import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArguments } from "./prepare-arguments.mjs";

const rejects = (argv, pattern) =>
  assert.throws(
    () => parseArguments(argv),
    (error) => {
      assert.equal(error.name, "FigmaSyncError");
      assert.equal(error.code, "ARGUMENT_INVALID");
      assert.match(error.message, pattern);
      return true;
    },
  );
const SCAN = [
  "scan",
  "--kind",
  "consumer",
  "--file-key",
  "6j7zsEZP6GF1TpEV38eCrs",
  "--roots",
  "10:1,10:2",
  "--run-id",
  "run-1",
];
const replace = (argv, name, value) => {
  const copy = [...argv];
  copy[copy.indexOf(name) + 1] = value;
  return copy;
};

test("固定六命令;各自的必要與可選參數", () => {
  assert.deepEqual(parseArguments(SCAN), {
    command: "scan",
    options: {
      kind: "consumer",
      fileKey: "6j7zsEZP6GF1TpEV38eCrs",
      roots: ["10:1", "10:2"],
      runId: "run-1",
    },
  });
  assert.deepEqual(
    parseArguments([
      "review",
      "--base",
      "a.json",
      "--brand",
      "b.json",
      "--selections-json",
      '[{"role":"main"}]',
      "--review-evidence-url",
      "https://github.com/acme/widgets/issues/1",
      "--consumer",
      "c.json",
      "--resolutions-json",
      "[]",
    ]).options,
    {
      base: "a.json",
      brand: "b.json",
      selectionsJson: [{ role: "main" }],
      reviewEvidenceUrl: "https://github.com/acme/widgets/issues/1",
      consumer: "c.json",
      resolutionsJson: [],
    },
  );
  const plan = [
    "plan",
    "--base",
    "a.json",
    "--brand",
    "b.json",
    "--consumer",
    "c.json",
    "--identity-review",
    "r.json",
    "--verification-target",
    "brand-bindings",
  ];
  assert.equal(
    parseArguments(plan).options.verificationTarget,
    "brand-bindings",
  );
  assert.equal(
    parseArguments([...plan, "--resume", "old/plan.json"]).options.resume,
    "old/plan.json",
  );
  assert.deepEqual(parseArguments(["plan-brand", "--brand", "b.json"]), {
    command: "plan-brand",
    options: { brand: "b.json" },
  });
  assert.deepEqual(parseArguments(["apply", "--plan", "p.json"]).options, {
    plan: "p.json",
  });
  assert.deepEqual(
    parseArguments(["record", "--request", "q.json", "--result", "r.json"])
      .options,
    { request: "q.json", result: "r.json" },
  );
});

test("未知命令、未知或重複旗標、缺值、缺必要參數都拒絕", () => {
  rejects([], /未知的命令/);
  rejects(["sync"], /未知的命令/);
  rejects(["--kind", "consumer"], /未知的命令/);
  rejects([...SCAN, "--force", "1"], /scan 只接受/);
  rejects([...SCAN, "--kind", "consumer"], /參數 --kind 重複/);
  rejects(SCAN.slice(0, -1), /參數 --run-id 缺少值/);
  rejects(replace(SCAN, "--roots", "--run-id"), /參數 --roots 缺少值/);
  rejects(SCAN.slice(0, 7), /scan 需要 --run-id/);
  // 命令之間的參數不互通
  rejects(["apply", "--plan", "p.json", "--resume", "x.json"], /apply 只接受/);
  rejects(
    ["plan-brand", "--brand", "b.json", "--base", "a.json"],
    /plan-brand 只接受/,
  );
  rejects(["record", "--request", "q.json"], /record 需要 --result/);
});

test("值的格式:kind 枚舉、單一路徑片段、節點 ID、JSON 型別、URL", () => {
  rejects(replace(SCAN, "--kind", "library"), /--kind 必須是/);
  for (const value of ["a/b", "..", ".", "a\\b", "x y", ".hidden"]) {
    rejects(replace(SCAN, "--run-id", value), /--run-id 必須是單一路徑片段/);
    rejects(
      replace(SCAN, "--file-key", value),
      /--file-key 必須是單一路徑片段/,
    );
  }
  rejects(replace(SCAN, "--roots", "10:1,,10:2"), /--roots/);
  rejects(replace(SCAN, "--roots", "10:1 10:2"), /--roots/);
  // roots 去重、保留順序;巢狀 instance 的 ID 可用
  assert.deepEqual(
    parseArguments(replace(SCAN, "--roots", "10:2, 10:1,10:2,I10:5;1:41"))
      .options.roots,
    ["10:2", "10:1", "I10:5;1:41"],
  );
  const review = [
    "review",
    "--base",
    "a.json",
    "--brand",
    "b.json",
    "--selections-json",
    "[]",
    "--review-evidence-url",
    "https://github.com/acme/widgets/issues/1",
  ];
  rejects(replace(review, "--selections-json", "{}"), /必須是單一 JSON 陣列/);
  rejects(replace(review, "--selections-json", "[1,"), /不是合法 JSON/);
  rejects(replace(review, "--review-evidence-url", "ftp://x"), /https URL/);
  rejects([...review, "--resolutions-json", "[]"], /需要同時提供 --consumer/);
});

test("library-upgrade 必須同時提供兩份 evidence JSON 物件", () => {
  const plan = [
    "plan",
    "--base",
    "a.json",
    "--brand",
    "b.json",
    "--consumer",
    "c.json",
    "--identity-review",
    "r.json",
    "--verification-target",
    "library-upgrade",
  ];
  rejects(plan, /library-upgrade 需要/);
  rejects(
    [...plan, "--publication-evidence-json", "{}"],
    /library-upgrade 需要/,
  );
  rejects(
    [
      ...plan,
      "--publication-evidence-json",
      "[]",
      "--acceptance-evidence-json",
      "{}",
    ],
    /必須是單一 JSON 物件/,
  );
  const parsed = parseArguments([
    ...plan,
    "--publication-evidence-json",
    '{"label":"v1"}',
    "--acceptance-evidence-json",
    '{"scope":"partial"}',
  ]);
  assert.deepEqual(parsed.options.publicationEvidenceJson, { label: "v1" });
  assert.deepEqual(parsed.options.acceptanceEvidenceJson, { scope: "partial" });
  rejects(
    replace(plan, "--verification-target", "full"),
    /--verification-target 必須是/,
  );
});

test("錯誤訊息不回印 argv 原值", () => {
  const secret = "::warning::leak line";
  for (const argv of [
    [secret],
    ["scan", secret, "x"],
    replace(SCAN, "--run-id", secret),
    replace(SCAN, "--kind", secret),
    replace(SCAN, "--roots", secret),
  ]) {
    assert.throws(
      () => parseArguments(argv),
      (error) =>
        !error.message.includes("leak") && !error.message.includes("warning"),
    );
  }
});

test("record:--result 與 --transport-result 互斥且必須擇一", () => {
  assert.deepEqual(
    parseArguments([
      "record",
      "--request",
      "q.json",
      "--transport-result",
      "e.json",
    ]).options,
    { request: "q.json", transportResult: "e.json" },
  );
  rejects(
    ["record", "--request", "q.json"],
    /record 需要 --result 或 --transport-result/,
  );
  rejects(
    [
      "record",
      "--request",
      "q.json",
      "--result",
      "r.json",
      "--transport-result",
      "e.json",
    ],
    /record 需要 --result 或 --transport-result/,
  );
  rejects(
    [
      "record",
      "--request",
      "q.json",
      "--transport-result",
      "e.json",
      "--chunk",
      "1",
    ],
    /record 只接受/,
  );
  rejects(["scan", "--transport-result", "e.json"], /scan 只接受/);
});
