import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { hashArtifact } from "./artifacts.mjs";
import * as executionSource from "./execution-source.mjs";
import * as prepare from "./prepare.mjs";
import {
  BASE_FILE,
  BRAND_FILE,
  CONSUMER_FILE,
  buildBaseLibrary,
  buildConsumer,
  cliScan,
  createFakeFigma,
  createWorld,
  executeAndRecord,
  executeSource,
  makeRepoRoot,
  readJson,
  runCli,
} from "./test-support.mjs";

const root = makeRepoRoot();
const world = createWorld();
const base = buildBaseLibrary(world);
const [brandPage] = world.addFile(BRAND_FILE, ["Brand"]);
buildConsumer(world, base);

const SCAN = (runId, extra = []) => [
  "scan",
  "--kind",
  "consumer",
  "--file-key",
  CONSUMER_FILE,
  "--roots",
  "10:1",
  "--run-id",
  runId,
  ...extra,
];
/** 失敗協定:exit 1、stdout 完全沒有輸出、stderr 恰好一行。 */
function assertFailure(result, pattern) {
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^figma-sync: [^\n]*\n$/);
  assert.match(result.stderr, pattern);
}
const collect = () => {
  const chunks = [];
  return { write: (chunk) => chunks.push(chunk), text: () => chunks.join("") };
};

test("import-safe:載入模組不執行 CLI;main 回傳退出碼並寫入注入的 io", () => {
  assert.equal(typeof prepare.main, "function");
  assert.equal(
    prepare.buildExecutionSource,
    executionSource.buildExecutionSource,
  );
  const io = { stdout: collect(), stderr: collect(), cwd: root };
  assert.equal(prepare.main(["sync"], io), 1);
  assert.equal(io.stdout.text(), "");
  assert.match(io.stderr.text(), /^figma-sync: 未知的命令[^\n]*\n$/);

  const ok = { stdout: collect(), stderr: collect(), cwd: root };
  assert.equal(prepare.main(SCAN("in-process"), ok), 0);
  assert.equal(ok.stderr.text(), "");
  const summary = JSON.parse(ok.stdout.text());
  assert.equal(summary.runId, "in-process");
  // 注入的時鐘決定 generatedAt(runtime 不讀本機檔,時間由 CLI 記在 request)
  const clocked = {
    ...ok,
    stdout: collect(),
    now: () => new Date("2030-05-06T07:08:09Z"),
  };
  assert.equal(prepare.main(SCAN("in-process-2"), clocked), 0);
  assert.equal(
    readJson(
      root,
      ".artifacts/figma-sync/in-process-2/request-consumer-scan.json",
    ).generatedAt,
    "2030-05-06T07:08:09.000Z",
  );
});

test("成功協定:stdout 一行 {runId,status,artifacts,counts}、stderr 空、exit 0", () => {
  const result = runCli(SCAN("proto-1"), { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^\{[^\n]*\}\n$/);
  assert.deepEqual(Object.keys(result.json), [
    "runId",
    "status",
    "artifacts",
    "counts",
  ]);
  assert.equal(result.json.runId, "proto-1");
  assert.equal(result.json.status, "scan-requested");
  assert.deepEqual(result.json.counts, { roots: 1 });
  const [request, source] = result.json.artifacts;
  assert.deepEqual(Object.keys(request), ["kind", "path", "digest"]);
  assert.equal(request.kind, "request");
  assert.equal(
    request.path,
    ".artifacts/figma-sync/proto-1/request-consumer-scan.json",
  );
  assert.equal(request.digest, hashArtifact(readJson(root, request.path)));
  // 生成 JS 的 kind 固定為 execution-source,digest 取完整 bytes
  assert.equal(source.kind, "execution-source");
  assert.equal(source.path, ".artifacts/figma-sync/proto-1/scan-consumer.js");
  assert.equal(
    source.digest,
    createHash("sha256")
      .update(readFileSync(path.join(root, source.path)))
      .digest("hex"),
  );
});

test("失敗協定:stdout 空、stderr 一行、exit 1;不回印 argv 或例外內容", () => {
  assertFailure(runCli([], { cwd: root }), /未知的命令/);
  assertFailure(
    runCli(SCAN("x", ["--force", "1"]), { cwd: root }),
    /scan 只接受/,
  );
  const injected = runCli(SCAN("a\n::warning::leak"), { cwd: root });
  assertFailure(injected, /--run-id 必須是單一路徑片段/);
  assert.ok(!injected.stderr.includes("leak"));
  // run-id 已使用
  assertFailure(runCli(SCAN("proto-1"), { cwd: root }), /RUN_EXISTS/);
  // 讀不到或不合協定的輸入:只有固定代碼,不帶檔案內容
  const secret = path.join(root, ".artifacts/figma-sync/secret.json");
  writeFileSync(secret, '{"token":"figd_SECRET"');
  const unreadable = runCli(["plan-brand", "--brand", secret], { cwd: root });
  assertFailure(unreadable, /^figma-sync: ARTIFACT_UNREADABLE\n$/);
  assert.ok(!unreadable.stderr.includes("SECRET"));
  assertFailure(
    runCli(["plan-brand", "--brand", "missing.json"], { cwd: root }),
    /ARTIFACT_UNREADABLE/,
  );
});

test("來源身分讀不到就停:不是 git repo、缺 deploy/project/github.json", () => {
  const plain = mkdtempSync(path.join(tmpdir(), "figma-sync-plain-"));
  cpSync(path.join(root, "deploy"), path.join(plain, "deploy"), {
    recursive: true,
  });
  assertFailure(runCli(SCAN("p1"), { cwd: plain }), /GIT_UNAVAILABLE/);
  const unnamed = makeRepoRoot();
  rmSync(path.join(unnamed, "deploy"), { recursive: true });
  assertFailure(
    runCli(SCAN("p2"), { cwd: unnamed }),
    /PROJECT_IDENTITY_UNREADABLE/,
  );
  assert.equal(existsSync(path.join(unnamed, ".artifacts")), false);
});

test("dirty 如實記錄:有未提交變更時 request 記 dirty=true", () => {
  const dirtyRoot = makeRepoRoot();
  const clean = runCli(SCAN("d1"), { cwd: dirtyRoot });
  writeFileSync(path.join(dirtyRoot, "note.txt"), "wip");
  const dirty = runCli(SCAN("d2"), { cwd: dirtyRoot });
  const project = (summary) =>
    readJson(dirtyRoot, summary.json.artifacts[0].path).project;
  assert.equal(project(clean).dirty, false);
  assert.equal(project(dirty).dirty, true);
  assert.equal(project(clean).gitCommit, project(dirty).gitCommit);
});
