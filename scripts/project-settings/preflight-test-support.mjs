/**
 * preflight 測試的夾具:真 Git 的目標 checkout,加上 gcloud 與 migrator status 子行程的假實作(系統邊界)。
 * status JSON 的形狀以 db-migrator 的型別與 docs/deployment.md「設定與資料更新」為準,不另訂格式。
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { sampleCloud, sampleGithub } from "./test-support.mjs";

/** 讓 git 子行程只用暫存的全域設定(不受使用者簽章、hooks 影響)。 */
export function isolateGitConfig() {
  const dir = mkdtempSync(path.join(tmpdir(), "preflight-git-"));
  const file = path.join(dir, "gitconfig");
  writeFileSync(
    file,
    "[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n[init]\n\tdefaultBranch = main\n[core]\n\tautocrlf = false\n[commit]\n\tgpgsign = false\n",
  );
  process.env.GIT_CONFIG_GLOBAL = file;
  process.env.GIT_CONFIG_NOSYSTEM = "1";
}

export function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} 失敗:${result.stderr}`);
  }
  return result.stdout.replace(/\n$/, "");
}

function commitFiles(cwd, files, message) {
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(cwd, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
    git(cwd, "add", file);
  }
  git(cwd, "commit", "-q", "-m", message);
  return git(cwd, "rev-parse", "HEAD");
}

export const PENDING_MIGRATION =
  "apps/db-migrator/migrations/base/20261001120000_data_sample.js";

/**
 * 目標 checkout 的歷史(每個 commit 一種來源):
 *   k0  初始(DB 最後成功 update 的 releaseCommit)
 *   k1  改專案種子 → api 目前部署的 commit
 *   k2  改 api       → admin 目前部署的 commit
 *   k3  新增 migration
 *   target 改 admin
 * 所以 api 與 admin 的累積差異不同,資料來源差異要從 k0(DB 基準)算,不是從 api image。
 */
export function createTargetCheckout() {
  const root = mkdtempSync(path.join(tmpdir(), "preflight-target-"));
  git(root, "init", "-q");
  // 專案身分取自 origin 的原始 URL(不 fetch,夾具沒有遠端內容)
  git(root, "remote", "add", "origin", "https://github.com/acme/widgets.git");
  const k0 = commitFiles(
    root,
    {
      "deploy/project/github.json": JSON.stringify(sampleGithub(), null, 2),
      "deploy/project/cloud.json": JSON.stringify(sampleCloud(), null, 2),
      "apps/db-migrator/seeds/project/settings.ts":
        "export const orgName = 'A';\n",
      "apps/api/src/app.ts": "export const app = 0;\n",
      "apps/admin/src/main.tsx": "export const main = 0;\n",
    },
    "k0",
  );
  const k1 = commitFiles(
    root,
    {
      "apps/db-migrator/seeds/project/settings.ts":
        "export const orgName = 'B';\n",
    },
    "k1: seed",
  );
  const k2 = commitFiles(
    root,
    { "apps/api/src/app.ts": "export const app = 1;\n" },
    "k2: api",
  );
  const k3 = commitFiles(
    root,
    { [PENDING_MIGRATION]: "module.exports = { up: async () => {} };\n" },
    "k3: migration",
  );
  const target = commitFiles(
    root,
    { "apps/admin/src/main.tsx": "export const main = 1;\n" },
    "target: admin",
  );
  return { root, commits: { k0, k1, k2, k3, target } };
}

export const shortSha = (root, commit) =>
  git(root, "rev-parse", "--short=7", commit);

const ISO = "2026-10-01T00:00:00.000Z";

/** F2 `RunSummary`。 */
export function runSummary(overrides = {}) {
  return {
    runId: "run-1",
    operation: "update",
    status: "succeeded",
    stage: "done",
    releaseCommit: null,
    startedAt: ISO,
    finishedAt: "2026-10-01T00:05:00.000Z",
    ...overrides,
  };
}

/** F2 status JSON:預設是「讀取完成、最後成功 update 在 releaseCommit、有一個待執行 migration」。 */
export function statusJson({ sourceCommit, releaseCommit, ...overrides }) {
  const baseline = runSummary({ releaseCommit });
  return {
    schemaVersion: 1,
    generatedAt: "2026-10-05T00:00:00.000Z",
    sourceCommit,
    lastAttempt: baseline,
    lastSuccessfulUpdate: baseline,
    subsequentRuns: [],
    migrations: {
      applied: [
        {
          fileName: "20260913120000_schema_changelog-filename-unique-index.js",
          origin: "legacy",
          appliedAt: ISO,
        },
      ],
      pending: [{ fileName: "20261001120000_data_sample.js", origin: "base" }],
      orphaned: [],
      open: [],
    },
    definitions: { open: [] },
    lock: null,
    ...overrides,
  };
}

export const SECRET_URI =
  "mongodb+srv://svc-user:hunter2-DB-PASSWORD@cluster0.example.net/widgets";
export const SERVICE_ENV_LEAK = "plain-env-value-should-not-leak";

const REGISTRY = "europe-west1-docker.pkg.dev/acme-widgets/widgets";
const AR_PACKAGES =
  "projects/acme-widgets/locations/europe-west1/repositories/widgets/packages";

export const digestOf = (seed) => seed.repeat(64).slice(0, 64);

/** `gcloud artifacts docker tags list` 回傳的一筆 tag(形狀照實際 gcloud 輸出)。 */
export function arTag(app, tag, digest, { image } = {}) {
  return {
    image: image ?? `${REGISTRY}/${app}`,
    tag: `${AR_PACKAGES}/${app}/tags/${tag}`,
    version: `${AR_PACKAGES}/${app}/versions/sha256:${digest}`,
  };
}

/**
 * gcloud 與 migrator status 子行程的假實作。
 * - `services`:服務名 → `[{ revision, percent }]`(實際承接流量);另放一個 0% 的最新 revision,不能被當成正在服務。
 * - `revisions`:revision 名 → `{ app, digest }`;revision 的 image 一律是 digest 形式。
 * - `tags`:digest → tags list 的回傳陣列。
 * - `status`:migrator 子行程的 `{ status, stdout, stderr }`;它收到的 MONGODB_URI 記在 `seenUris`。
 * 回應裡故意夾帶 env 值與 Secret,報告不得出現。
 */
export function createFakeCloud({
  services = {},
  revisions = {},
  tags = {},
  status,
  failServices = false,
}) {
  const calls = [];
  const seenUris = [];
  const valueOf = (args, prefix) =>
    args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);

  function runExternal(command, args, options = {}) {
    calls.push({ command, args: [...args] });
    const ok = (value) => ({
      status: 0,
      stdout: typeof value === "string" ? value : JSON.stringify(value),
      stderr: "",
    });
    if (command === "gcloud") {
      const joined = args.join(" ");
      if (joined.startsWith("run services describe")) {
        if (failServices) {
          return {
            status: 1,
            stdout: "",
            stderr: `ERROR: permission denied for token ya29.SECRET-ACCESS-TOKEN`,
          };
        }
        const name = args[3];
        const traffic = services[name] ?? [];
        return ok({
          metadata: { name },
          spec: {
            template: {
              spec: {
                containers: [
                  { env: [{ name: "PLAIN", value: SERVICE_ENV_LEAK }] },
                ],
              },
            },
          },
          status: {
            latestCreatedRevisionName: `${name}-00099-new`,
            traffic: [
              ...traffic.map(({ revision, percent }) => ({
                revisionName: revision,
                percent,
              })),
              { revisionName: `${name}-00099-new`, percent: 0, tag: "preview" },
            ],
          },
        });
      }
      if (joined.startsWith("run revisions describe")) {
        const name = args[3];
        const revision = revisions[name];
        if (revision === undefined) {
          return { status: 1, stdout: "", stderr: "not found" };
        }
        const image = `${REGISTRY}/${revision.app}@sha256:${revision.digest}`;
        return ok({
          metadata: { name },
          spec: {
            containers: [
              {
                image,
                env: [{ name: "MONGODB_URI", value: SECRET_URI }],
              },
            ],
          },
          status: { imageDigest: image },
        });
      }
      if (joined.startsWith("artifacts docker tags list")) {
        const filter = valueOf(args, "--filter=version:sha256:");
        return ok(tags[filter] ?? []);
      }
      if (joined.startsWith("secrets versions access")) {
        return ok(`${SECRET_URI}\n`);
      }
      return { status: 1, stdout: "", stderr: "unsupported gcloud call" };
    }
    const isStatus =
      command === "migrator" &&
      args.includes("--json") &&
      args.includes("--status");
    if (isStatus) {
      seenUris.push(options.env?.MONGODB_URI);
      return status;
    }
    return { status: 127, stdout: "", stderr: `unexpected ${command}` };
  }
  return { runExternal, calls, seenUris };
}

export { REGISTRY };
