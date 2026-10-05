/**
 * CLI fixture:隔離的 git repo、子行程執行 CLI、在 fake Figma 真執行生成碼,並走與正式操作相同的交接
 *(執行入口只把回傳的 JSON 值存檔,交給 record --transport-result;未接齊就執行 CLI 給的下一支唯讀 JS)。
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createFakeFigma, createWorld } from "./test-support-figma.mjs";
import { selectionsFor } from "./test-support-flows.mjs";
import {
  BASE_FILE,
  BRAND_FILE,
  CONSUMER_FILE,
  buildBaseLibrary,
  buildConsumer,
} from "./test-support-scenes.mjs";

export const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

function git(cwd, args) {
  const result = spawnSync(
    "git",
    ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args],
    { cwd, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} 失敗:${result.stderr}`);
  }
  return result.stdout.trim();
}

/** 隔離的專案根目錄:自己的 git 歷史與 repo 身分;run 暫存已 gitignore。 */
export function makeRepoRoot(repository = "acme/widgets") {
  const root = mkdtempSync(path.join(tmpdir(), "figma-sync-"));
  mkdirSync(path.join(root, "deploy/project"), { recursive: true });
  writeFileSync(
    path.join(root, "deploy/project/github.json"),
    JSON.stringify({ schemaVersion: 1, expectedRepository: repository }),
  );
  writeFileSync(path.join(root, ".gitignore"), ".artifacts/figma-sync/\n");
  git(root, ["init", "--quiet"]);
  commitAll(root, "init");
  return root;
}

export function commitAll(root, message) {
  git(root, ["add", "--all"]);
  git(root, ["commit", "--quiet", "--allow-empty", "-m", message]);
}

/**
 * 以子行程跑 CLI;設定與 artifact 相對於 `cwd` 解析。
 * 所有測試都使用正式 prepare.mjs 與固定工具輸入上限。
 */
export function runCli(args, { cwd }) {
  const entry = "prepare.mjs";
  const result = spawnSync(
    process.execPath,
    [path.join(scriptsDir, entry), ...args],
    { cwd, encoding: "utf8" },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: result.status === 0 ? JSON.parse(result.stdout) : null,
  };
}

/** 在 fake Figma 真的執行生成碼(與現有 Figma 工具相同:async 函式本體、全域 figma、回傳值)。 */
export function executeSource(source, figma) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  return new AsyncFunction("figma", source)(figma);
}

export const readJson = (root, relative) =>
  JSON.parse(readFileSync(path.join(root, relative), "utf8"));

let sequence = 0;
/** 把一次 Figma 回傳的 JSON 值存成檔案(模擬 caller 保存 text content)。 */
export function saveReturned(root, value) {
  sequence += 1;
  const target = path.join(
    root,
    ".artifacts/figma-sync",
    `returned-${process.pid}-${sequence}.json`,
  );
  writeFileSync(target, JSON.stringify(value));
  return target;
}

/**
 * 執行 CLI 生成的 JS 並交給 record --transport-result,直到 record 不再回 transport-pending。
 * options.figma:fake Figma 的選項;options.transformHead:改寫首次回傳的 envelope;
 * options.beforeRead(index):每次執行唯讀分塊 JS 之前的鉤子(測漂移用)。
 * 回傳 {record, envelopes, calls, requestPath};record 是最後一次 CLI 結果。
 */
export async function executeAndRecord(
  root,
  world,
  fileKey,
  summary,
  options = {},
) {
  const find = (kind) => summary.artifacts.find((item) => item.kind === kind);
  const requestPath = path.join(root, find("request").path);
  const envelopes = [];
  let sourcePath = find("execution-source").path;
  let record = null;
  let calls = 0;
  for (;;) {
    if (calls > 0 && options.beforeRead) await options.beforeRead(calls - 1);
    const source = readFileSync(path.join(root, sourcePath), "utf8");
    let envelope = await executeSource(
      source,
      createFakeFigma(world, fileKey, options.figma),
    );
    if (calls === 0 && options.transformHead) {
      envelope = options.transformHead(envelope);
    }
    calls += 1;
    envelopes.push(envelope);
    record = runCli(
      [
        "record",
        "--request",
        requestPath,
        "--transport-result",
        saveReturned(root, envelope),
      ],
      { cwd: root },
    );
    const pending =
      record.status === 0 && record.json.status === "transport-pending";
    if (!pending) break;
    sourcePath = record.json.artifacts[0].path;
  }
  return { record, envelopes, calls, requestPath };
}

/** scan → 執行 → record;回傳封存的 inventory 路徑(相對於 root)。 */
export async function cliScan(root, world, kind, fileKey, roots, runId) {
  const requested = runCli(
    [
      "scan",
      "--kind",
      kind,
      "--file-key",
      fileKey,
      "--roots",
      roots.join(","),
      "--run-id",
      runId,
    ],
    { cwd: root },
  );
  if (requested.status !== 0) {
    throw new Error(`scan 失敗:${requested.stderr}`);
  }
  const { record } = await executeAndRecord(
    root,
    world,
    fileKey,
    requested.json,
  );
  if (record.status !== 0) throw new Error(`record 失敗:${record.stderr}`);
  return record.json.artifacts.find(
    (item) => item.kind === "inventory" && /inventory-/.test(item.path),
  ).path;
}

/** plan(或 plan-brand)→ apply → 執行 → record 的一輪;任何一步的 CLI 結果都回傳。 */
export async function cliSync(root, world, fileKey, planArgs, options = {}) {
  const planned = runCli(planArgs, { cwd: root });
  if (planned.status !== 0 || planned.json.status === "blocked") {
    return { planned };
  }
  const planPath = planned.json.artifacts[0].path;
  const applied = runCli(["apply", "--plan", planPath], { cwd: root });
  if (applied.status !== 0) return { planned, applied };
  const executed = await executeAndRecord(
    root,
    world,
    fileKey,
    applied.json,
    options,
  );
  return { planned, applied, planPath, ...executed };
}

export const REVIEW_URL = "https://github.com/acme/widgets/issues/23";
export const RECEIPTS = "deploy/project/figma/receipts";

/** run 目錄的檔案清單(頂層、inputs/、transport/<operation>/ 分開列)。 */
export function runFiles(root, runId) {
  const runDir = path.join(root, ".artifacts/figma-sync", runId);
  const list = (dir) =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name)
          .sort()
      : [];
  return {
    top: list(runDir),
    inputs: list(path.join(runDir, "inputs")),
    transport: list(path.join(runDir, "transport/scan")).concat(
      list(path.join(runDir, "transport/apply")),
    ),
  };
}

export const planArgs = (paths, extra = []) => [
  "plan",
  "--base",
  paths.base,
  "--brand",
  paths.brand,
  "--consumer",
  paths.consumer,
  "--identity-review",
  paths.review,
  "--verification-target",
  "brand-bindings",
  ...extra,
];

/** 以 CLI 生成 identity-review;resolutions 可選。回傳 CLI 結果。 */
export function cliReview(root, paths, selections, resolutions = null) {
  const args = [
    "review",
    "--base",
    paths.base,
    "--brand",
    paths.brand,
    "--selections-json",
    JSON.stringify(selections),
    "--review-evidence-url",
    REVIEW_URL,
  ];
  if (resolutions) {
    args.push(
      "--consumer",
      paths.consumer,
      "--resolutions-json",
      JSON.stringify(resolutions),
    );
  }
  return runCli(args, { cwd: root });
}

/**
 * 全程走六命令備妥的起點:三側檔案、底座與 consumer 的掃描、由工具初建並驗證過的品牌庫、已審查的身分對照。
 * consumer 尚未補套。
 */
export async function bootstrapCli(repository = "acme/widgets") {
  const root = makeRepoRoot(repository);
  const world = createWorld();
  const base = buildBaseLibrary(world);
  const [brandPage] = world.addFile(BRAND_FILE, ["Brand"]);
  const consumer = buildConsumer(world, base);
  const paths = {};
  paths.base = await cliScan(
    root,
    world,
    "base-library",
    BASE_FILE,
    [base.page.id],
    "boot-base",
  );
  const empty = await cliScan(
    root,
    world,
    "brand-library",
    BRAND_FILE,
    [brandPage.id],
    "boot-brand-0",
  );
  const brandRun = await cliSync(root, world, BRAND_FILE, [
    "plan-brand",
    "--brand",
    empty,
  ]);
  if (!brandRun.record || brandRun.record.status !== 0) {
    throw new Error("品牌庫初建失敗");
  }
  // 發布後重掃品牌庫(published keys),再以它規劃 consumer
  paths.brand = await cliScan(
    root,
    world,
    "brand-library",
    BRAND_FILE,
    [brandPage.id],
    "boot-brand-1",
  );
  paths.consumer = await cliScan(
    root,
    world,
    "consumer",
    CONSUMER_FILE,
    ["10:1"],
    "boot-con",
  );
  const selections = selectionsFor(
    readJson(root, paths.base),
    readJson(root, paths.brand),
  );
  const review = cliReview(root, paths, selections);
  if (review.status !== 0) throw new Error(`review 失敗:${review.stderr}`);
  paths.review = review.json.artifacts[0].path;
  world.resetLog();
  return {
    root,
    world,
    base,
    brandPage,
    consumer,
    paths,
    selections,
    brandRun,
    review,
    emptyBrandPath: empty,
  };
}
