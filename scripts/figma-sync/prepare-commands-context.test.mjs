import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { projectPublic } from "@repo/project-config/public";

import { hashArtifact, writeArtifact } from "./artifacts.mjs";
import { createFigmaBrandProjection } from "./brand.mjs";
import {
  createProjectContext,
  header,
  ownRunDir,
  readKind,
  runDirOf,
  saveInputs,
} from "./prepare-commands-context.mjs";
import { createScenario, makeRepoRoot } from "./test-support.mjs";

const code = (expected) => (error) => {
  assert.equal(error.name, "FigmaSyncError");
  assert.equal(error.code, expected, error.message);
  return true;
};

test("來源身分:repo 取 deploy/project/github.json、品牌取 projectPublic;dirty 如實記錄", () => {
  const rootDir = makeRepoRoot("acme/widgets");
  const context = createProjectContext({ rootDir });
  assert.equal(context.project.repository, "acme/widgets");
  assert.equal(context.project.slug, projectPublic.slug);
  assert.match(context.project.gitCommit, /^[0-9a-f]{40}$/);
  assert.equal(context.project.dirty, false);
  assert.equal(
    context.project.brandInputDigest,
    hashArtifact(projectPublic.brand),
  );
  assert.deepEqual(
    context.brandProjection,
    createFigmaBrandProjection(projectPublic),
  );
  writeFileSync(path.join(rootDir, "note.txt"), "wip");
  const dirty = createProjectContext({ rootDir });
  assert.equal(dirty.project.dirty, true);
  assert.equal(dirty.project.gitCommit, context.project.gitCommit);
});

test("工具來源 digest:涵蓋本機 modules 與 codec / bundler 版本,同一來源穩定", () => {
  const rootDir = makeRepoRoot();
  const first = createProjectContext({ rootDir }).tool;
  const second = createProjectContext({ rootDir: makeRepoRoot("x/y") }).tool;
  assert.match(first.sourceDigest, /^[0-9a-f]{64}$/);
  assert.match(first.gitCommit, /^[0-9a-f]{40}$/);
  // 與專案無關:只由工具自己的來源決定
  assert.deepEqual(second, first);
});

test("來源身分讀不到就停:不是 git repo、缺或壞掉的 github.json", () => {
  const plain = mkdtempSync(path.join(tmpdir(), "figma-sync-plain-"));
  const rootDir = makeRepoRoot();
  cpSync(path.join(rootDir, "deploy"), path.join(plain, "deploy"), {
    recursive: true,
  });
  assert.throws(
    () => createProjectContext({ rootDir: plain }),
    code("GIT_UNAVAILABLE"),
  );
  const unnamed = makeRepoRoot();
  rmSync(path.join(unnamed, "deploy"), { recursive: true });
  assert.throws(
    () => createProjectContext({ rootDir: unnamed }),
    code("PROJECT_IDENTITY_UNREADABLE"),
  );
  const broken = makeRepoRoot();
  writeFileSync(path.join(broken, "deploy/project/github.json"), "{ not json");
  assert.throws(
    () => createProjectContext({ rootDir: broken }),
    code("PROJECT_IDENTITY_UNREADABLE"),
  );
  const empty = makeRepoRoot();
  writeFileSync(path.join(empty, "deploy/project/github.json"), "{}");
  assert.throws(
    () => createProjectContext({ rootDir: empty }),
    code("PROJECT_IDENTITY_UNREADABLE"),
  );
});

test("runId 與時間:工具生成的 runId 唯一且是單一路徑片段;時鐘可注入", () => {
  const rootDir = makeRepoRoot();
  const context = createProjectContext({
    rootDir,
    now: () => new Date("2030-05-06T07:08:09.123Z"),
  });
  assert.equal(context.timestamp(), "2030-05-06T07:08:09.123Z");
  const ids = new Set(
    Array.from({ length: 20 }, () => context.newRunId("plan")),
  );
  assert.equal(ids.size, 20);
  for (const id of ids) assert.match(id, /^plan-20300506T070809Z-[0-9a-f]{8}$/);
  assert.deepEqual(header(context, "request", "r1"), {
    schemaVersion: 1,
    kind: "request",
    runId: "r1",
    generatedAt: "2030-05-06T07:08:09.123Z",
    project: context.project,
    tool: context.tool,
  });
  assert.equal(
    runDirOf(context, "r1"),
    path.join(rootDir, ".artifacts/figma-sync", "r1"),
  );
});

test("輸入 artifact:kind 與專案要相符、位置要在自己的 run 目錄;snapshot 原樣保存", async () => {
  const rootDir = makeRepoRoot("acme/widgets");
  const context = createProjectContext({ rootDir });
  const scenario = await createScenario();
  const raw = await scenario.scanConsumer("ctx-scan");
  // 測試夾具的 slug 與正式專案不同:別的專案產出的 artifact 不能混進來
  const runDir = runDirOf(context, raw.runId);
  const written = writeArtifact({
    runDir,
    name: "inventory-consumer.json",
    artifact: raw,
  });
  assert.throws(
    () => readKind(written.path, "inventory", context),
    code("PROJECT_MISMATCH"),
  );
  const own = {
    ...raw,
    project: { ...raw.project, slug: context.project.slug },
  };
  const ownDir = runDirOf(context, "ctx-own");
  const ownPath = writeArtifact({
    runDir: ownDir,
    name: "inventory-consumer.json",
    artifact: { ...own, runId: "ctx-own" },
  }).path;
  assert.equal(readKind(ownPath, "inventory", context).runId, "ctx-own");
  assert.throws(
    () => readKind(ownPath, "plan", context),
    code("ARTIFACT_KIND_MISMATCH"),
  );
  const artifact = readKind(ownPath, "inventory", context);
  assert.equal(
    ownRunDir(ownPath, artifact, context, ["inventory-consumer.json"]),
    ownDir,
  );
  assert.throws(
    () => ownRunDir(ownPath, artifact, context, ["plan.json"]),
    code("ARTIFACT_LOCATION_INVALID"),
  );
  assert.throws(
    () =>
      ownRunDir(written.path, artifact, context, ["inventory-consumer.json"]),
    code("ARTIFACT_LOCATION_INVALID"),
  );
  // 缺少的 optional input 不建立;已有的原樣保存、digest 不變
  saveInputs(ownDir, {
    "inventory-consumer": artifact,
    "previous-receipt": null,
  });
  const snapshot = readKind(
    path.join(ownDir, "inputs/inventory-consumer.json"),
    "inventory",
    context,
  );
  assert.equal(hashArtifact(snapshot), hashArtifact(artifact));
});
