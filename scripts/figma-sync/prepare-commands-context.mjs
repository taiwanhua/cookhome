/**
 * figma-sync 各命令共用的 context:目前專案與工具的來源身分、品牌投影,以及 run 目錄與輸入 snapshot 的處理。
 * 品牌輸入只有 `@repo/project-config/public` 的 projectPublic.brand;repo 身分取 deploy/project/github.json。
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { projectPublic } from "@repo/project-config/public";

import {
  RUNS_DIR,
  hashArtifact,
  readArtifact,
  writeArtifact,
} from "./artifacts.mjs";
import { createFigmaBrandProjection } from "./brand.mjs";
import { createCore } from "./core.mjs";
import { sourceCompilerFingerprint } from "./execution-source.mjs";
import { codecFingerprint } from "./transport-codec.mjs";

export const { contract, core } = createCore();
const { fail } = contract;
const toolDir = path.dirname(fileURLToPath(import.meta.url));

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) fail("GIT_UNAVAILABLE");
  return result.stdout.trim();
}

/**
 * 工具來源的 digest:參與生成的本機 modules(非測試的 .mjs,換行正規化後連同檔名)、
 * codec / bundler 的固定版本與實際 codec bundle;不同依賴或未提交的修改不會被當成同一工具來源。
 */
function toolSourceDigest() {
  const hash = createHash("sha256");
  const names = readdirSync(toolDir)
    .filter((name) => /\.mjs$/.test(name) && !/test/.test(name))
    .sort();
  for (const name of names) {
    const text = readFileSync(path.join(toolDir, name), "utf8");
    hash.update(`${name}\0${text.replaceAll("\r\n", "\n")}\0`);
  }
  hash.update(
    JSON.stringify({ ...codecFingerprint(), ...sourceCompilerFingerprint() }),
  );
  return hash.digest("hex");
}

/** 目前專案與工具的來源身分。dirty 如實記錄,不拿 commit 冒稱完整輸入。 */
export function createProjectContext({ rootDir, now = () => new Date() }) {
  let repository;
  try {
    repository = JSON.parse(
      readFileSync(path.join(rootDir, "deploy/project/github.json"), "utf8"),
    ).expectedRepository;
  } catch {
    fail("PROJECT_IDENTITY_UNREADABLE");
  }
  if (typeof repository !== "string" || repository === "") {
    fail("PROJECT_IDENTITY_UNREADABLE");
  }
  return {
    rootDir,
    brandProjection: createFigmaBrandProjection(projectPublic),
    project: {
      slug: projectPublic.slug,
      repository,
      gitCommit: git(rootDir, ["rev-parse", "HEAD"]),
      dirty: git(rootDir, ["status", "--porcelain"]) !== "",
      brandInputDigest: hashArtifact(projectPublic.brand),
    },
    tool: {
      gitCommit: git(toolDir, ["rev-parse", "HEAD"]),
      sourceDigest: toolSourceDigest(),
    },
    timestamp: () => now().toISOString(),
    newRunId: (prefix) =>
      `${prefix}-${now()
        .toISOString()
        .replace(/[-:]|\.\d+/g, "")}-${randomBytes(4).toString("hex")}`,
  };
}

export const runDirOf = (context, runId) =>
  path.join(context.rootDir, RUNS_DIR, runId);

export const header = (context, kind, runId) => ({
  schemaVersion: 1,
  kind,
  runId,
  generatedAt: context.timestamp(),
  project: context.project,
  tool: context.tool,
});

/** 讀一份指定 kind 的 artifact;別的專案產出的不能混進來。 */
export function readKind(filePath, kind, context) {
  const artifact = readArtifact(filePath);
  if (artifact.kind !== kind) fail("ARTIFACT_KIND_MISMATCH", kind);
  const foreign =
    artifact.project.repository !== context.project.repository ||
    artifact.project.slug !== context.project.slug;
  if (foreign) fail("PROJECT_MISMATCH");
  return artifact;
}

/** 輸入 snapshot 原樣保存到同 run 的 inputs/,不改寫其 runId / generatedAt。 */
export function saveInputs(runDir, inputs) {
  for (const [name, artifact] of Object.entries(inputs)) {
    if (artifact) {
      writeArtifact({ runDir, name: `inputs/${name}.json`, artifact });
    }
  }
}

/** 檔案必須位於它自己 runId 的 run 目錄,且檔名固定;不接任意路徑。 */
export function ownRunDir(filePath, artifact, context, names) {
  const runDir = runDirOf(context, artifact.runId);
  const expected = names.map((name) => path.resolve(runDir, name));
  if (!expected.includes(path.resolve(filePath))) {
    fail("ARTIFACT_LOCATION_INVALID");
  }
  return runDir;
}
