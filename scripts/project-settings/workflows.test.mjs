/**
 * workflow 接線的離線驗證:從 YAML 取出 step,用 bash + 假的 gcloud / docker / pnpm / git 實際執行 run 腳本,
 * 看板步驟用假的 GitHub client 執行內嵌腳本。不觸發任何真的 Actions、雲端、資料庫或看板操作。
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  LEGACY_COOKHOME_REPOSITORY,
  findStep,
  installScripts,
  makeLegacyCookhomeRoot,
  makeProjectRoot,
  parseSteps,
  readWorkflow,
  repoRoot,
  runJob,
  runNamedStep,
  sampleCloud,
  sampleGithub,
} from "./test-support.mjs";

// 「與抽設定前逐字相同」的對照一律以固定的 CookHome 相容性夾具為輸入(test-support.mjs),
// 不讀 repo 裡的正式設定:正式設定換 endpoint、換資源或換專案都不該讓這些測試變紅。
const COOKHOME = LEGACY_COOKHOME_REPOSITORY;
const legacyRoot = makeLegacyCookhomeRoot();
const REGISTRY = "asia-east1-docker.pkg.dev/cookhome-online/cookhome";
const WORKFLOWS = ["deploy.yml", "reset-db.yml", "project-status.yml"];

const isAuth = (entry) =>
  (entry.uses ?? "").startsWith("google-github-actions/auth@");
const isScript = (entry) =>
  (entry.uses ?? "").startsWith("actions/github-script@");
const commands = (calls, ...names) =>
  calls.filter((call) => names.includes(call[0])).map((call) => call.join(" "));
const exported = (calls) =>
  Object.fromEntries(
    calls
      .filter((call) => call[0] === "env")
      .map((call) => {
        const at = call[1].indexOf("=");
        return [call[1].slice(0, at), call[1].slice(at + 1)];
      }),
  );

// ---------------------------------------------------------------- 共通接線

test("三支 workflow 的 run 腳本都不內插 ${{ }}、不用 eval,設定值只經 env 傳入", () => {
  for (const name of WORKFLOWS) {
    for (const step of parseSteps(readWorkflow(name))) {
      if (step.run === undefined) continue;
      assert.doesNotMatch(step.run, /\$\{\{/, `${name}:${step.name}`);
      assert.doesNotMatch(step.run, /\beval\b/, `${name}:${step.name}`);
    }
  }
});

test("workflow 不再寫死任何專案識別(GCP、WIF、Secret 名稱、網域、seed 信箱、看板 ID)", () => {
  const forbidden =
    /cookhome-online|728045896207|github-deployer|a0987837233|mongodb-uri|root-admin-password|field-encryption-key|jwt-secret|resend-api-key|cookhome\.online|cookhome-(api|admin)|asia-east1|PVT_|PVTSSF_|2882aeb7|43e18a1a|0eaa8179|e94980d1|e3445e43|b6b968cd/;
  for (const name of WORKFLOWS) {
    assert.doesNotMatch(readWorkflow(name), forbidden, name);
  }
});

test("步驟擷取器對得上實際檔案:每個 step 都有 name 或 uses", () => {
  for (const name of WORKFLOWS) {
    const text = readWorkflow(name);
    const steps = parseSteps(text);
    const expected = text
      .split("\n")
      .filter((line) => /^ {6}- /.test(line)).length;
    assert.equal(steps.length, expected, name);
    for (const step of steps) assert.ok(step.name ?? step.uses, name);
  }
});

// ---------------------------------------------------------------- deploy.yml

const deployText = readWorkflow("deploy.yml");
const deploySteps = parseSteps(deployText);

const ORIGINAL_DEPLOY = {
  dev: {
    branch: "dev",
    suffix: "-dev",
    api: "https://api-dev.cookhome.online",
  },
  staging: {
    branch: "staging",
    suffix: "-staging",
    api: "https://api-staging.cookhome.online",
  },
  production: {
    branch: "main",
    suffix: "",
    api: "https://api.cookhome.online",
  },
};

/** 抽設定前 deploy.yml 在「api / admin / migrate 全部受影響」時依序打出的命令(逐字手抄)。 */
function originalDeployCommands(environment) {
  const { suffix, api } = ORIGINAL_DEPLOY[environment];
  const describe = (service) =>
    `gcloud run services describe ${service} --region=asia-east1 --format=value(spec.template.spec.containers[0].image)`;
  return [
    "gcloud auth configure-docker asia-east1-docker.pkg.dev --quiet",
    describe(`cookhome-api${suffix}`),
    describe(`cookhome-admin${suffix}`),
    describe(`cookhome-api${suffix}`),
    `docker build -f apps/api/Dockerfile -t ${REGISTRY}/api:abc1234 .`,
    `docker push ${REGISTRY}/api:abc1234`,
    `docker build -f apps/admin/Dockerfile -t ${REGISTRY}/admin:abc1234${suffix} --build-arg VITE_GRAPHQL_ENDPOINT=${api}/graphql .`,
    `docker push ${REGISTRY}/admin:abc1234${suffix}`,
    `gcloud run deploy cookhome-api${suffix} --region=asia-east1 --image=${REGISTRY}/api:abc1234 --port=5001 --allow-unauthenticated --min-instances=0 --max-instances=2 --env-vars-file=deploy/env/${environment}.yaml --set-secrets=MONGODB_URI=mongodb-uri${suffix}:latest,FIELD_ENCRYPTION_KEY=field-encryption-key${suffix}:latest,JWT_SECRET=jwt-secret${suffix}:latest,RESEND_API_KEY=resend-api-key${suffix}:latest --quiet`,
    `gcloud run deploy cookhome-admin${suffix} --region=asia-east1 --image=${REGISTRY}/admin:abc1234${suffix} --port=8080 --allow-unauthenticated --min-instances=0 --max-instances=2 --quiet`,
    "pnpm install --frozen-lockfile --filter @repo/db-migrator...",
    `gcloud secrets versions access latest --secret=mongodb-uri${suffix}`,
    `gcloud secrets versions access latest --secret=root-admin-password${suffix}`,
    "pnpm --filter @repo/db-migrator migrate",
    "pnpm --filter @repo/db-migrator seed",
  ];
}

const deployEnv = (overrides = {}) => ({
  FAKE_HEAD: "abc1234",
  FAKE_BASE_IN_HISTORY: "1",
  FAKE_API_IMAGE: "registry.example/app/api:0ld5ha1",
  FAKE_ADMIN_IMAGE: "registry.example/app/admin:0ld5ha1-dev",
  FAKE_DIFF: "apps/api/src/main.ts\n",
  FAKE_TURBO_AFFECTED: "@repo/api @repo/admin @repo/db-migrator",
  FAKE_MONGODB_URI: "mongodb://fake-host/fake-db",
  ...overrides,
});

const runDeploy = (
  environment,
  { repository = COOKHOME, cwd = legacyRoot, env, force = "false" } = {},
) =>
  runJob("deploy.yml", {
    inputs: { environment, force },
    github: { repository },
    env: {
      GITHUB_REF_NAME: ORIGINAL_DEPLOY[environment]?.branch ?? "dev",
      ...deployEnv(env),
    },
    cwd,
  });

test("deploy:只能手動觸發,environment / force 輸入與權限不變", () => {
  assert.match(deployText, /^on:\n {2}workflow_dispatch:\n/m);
  assert.doesNotMatch(
    deployText,
    /^ {2}(push|pull_request|schedule|workflow_run):/m,
  );
  assert.match(deployText, /options: \[dev, staging, production\]/);
  assert.match(deployText, /force:[\s\S]*?type: boolean\n\s+default: false/);
  assert.match(
    deployText,
    /^permissions:\n {2}contents: read\n {2}id-token: write/m,
  );
});

test("deploy:讀設定在 checkout 之後、雲端認證之前;認證參數全部來自設定", () => {
  const order = (predicate) => findStep(deploySteps, predicate).index;
  const guard = order((step) => step.name === "分支 ↔ 環境防呆");
  const checkout = order((step) =>
    (step.uses ?? "").startsWith("actions/checkout@"),
  );
  const config = order((step) => step.id === "cfg");
  const auth = order(isAuth);
  assert.ok(guard < checkout && checkout < config && config < auth);
  assert.equal(deploySteps[checkout].with["fetch-depth"], "0");
  assert.match(deploySteps[config].run, /read-config\.mjs --scope cloud /);
  assert.equal(deploySteps[config].env.REPOSITORY, "${{ github.repository }}");
  assert.deepEqual(deploySteps[auth].with, {
    project_id: "${{ steps.cfg.outputs.gcp_project_id }}",
    workload_identity_provider: "${{ steps.cfg.outputs.wif_provider }}",
    service_account: "${{ steps.cfg.outputs.deployer_sa }}",
  });
});

for (const environment of Object.keys(ORIGINAL_DEPLOY)) {
  test(`deploy ${environment}:命令與抽設定前逐字相同(SHA image tag、migrate → seed 順序)`, async () => {
    const job = await runDeploy(environment);
    assert.equal(job.failed, null, job.failed?.stderr);
    assert.deepEqual(
      commands(job.calls, "gcloud", "docker", "pnpm"),
      originalDeployCommands(environment),
    );
    const auth = job.trace.find(isAuth);
    assert.deepEqual(auth.with, {
      project_id: "cookhome-online",
      workload_identity_provider:
        "projects/728045896207/locations/global/workloadIdentityPools/github/providers/github-oidc",
      service_account:
        "github-deployer@cookhome-online.iam.gserviceaccount.com",
    });
    assert.deepEqual(exported(job.calls), {
      MONGODB_URI: "mongodb://fake-host/fake-db",
      ROOT_ADMIN_PASSWORD: "fake-secret-value",
      ROOT_ADMIN_ACCOUNT: "root",
      ROOT_ADMIN_EMAIL: "a0987837233@gmail.com",
      RESET_ALLOW_ENV: "",
    });
  });
}

test("deploy:分支與環境不對應時在 checkout 前失敗", async () => {
  const pairs = [
    ["dev", "main"],
    ["staging", "dev"],
    ["production", "staging"],
    ["production", "dev"],
    ["qa", "dev"],
    ["", "main"],
  ];
  for (const [environment, branch] of pairs) {
    const job = await runJob("deploy.yml", {
      inputs: { environment, force: "false" },
      github: { repository: COOKHOME },
      env: { GITHUB_REF_NAME: branch, ...deployEnv() },
      cwd: legacyRoot,
    });
    assert.equal(
      job.failed?.label,
      "分支 ↔ 環境防呆",
      `${environment} ← ${branch}`,
    );
    assert.equal(job.trace.length, 1);
    assert.deepEqual(job.calls, []);
  }
});

test("deploy:repository 不符、缺值、壞設定時,在認證與任何 gcloud / docker 之前停止", async () => {
  const missingValue = sampleCloud();
  delete missingValue.environments.dev.secrets.resendApiKey;
  const scenarios = [
    { repository: "someone/cookhome-fork", cwd: legacyRoot },
    { repository: "other/project", cwd: installScripts(makeProjectRoot()) },
    {
      repository: "acme/widgets",
      cwd: installScripts(makeProjectRoot({ cloud: missingValue })),
    },
    {
      repository: "acme/widgets",
      cwd: installScripts(makeProjectRoot({ cloud: null })),
    },
    {
      repository: "acme/widgets",
      cwd: installScripts(makeProjectRoot({ github: null })),
    },
    {
      repository: "acme/widgets",
      cwd: installScripts(
        makeProjectRoot({ cloud: { ...sampleCloud(), schemaVersion: 2 } }),
      ),
    },
  ];
  for (const { repository, cwd } of scenarios) {
    const job = await runDeploy("dev", { repository, cwd });
    assert.equal(job.failed?.label, "專案設定(核對 repo 與環境)", repository);
    assert.notEqual(job.failed.stderr, "");
    assert.equal(job.trace.some(isAuth), false);
    assert.deepEqual(job.calls, []);
    assert.deepEqual(
      Object.keys(job.failed.outputs),
      [],
      "失敗時不留下任何輸出",
    );
  }
});

test("deploy:非法環境直接交給設定步驟也會被拒絕", () => {
  const result = runNamedStep("deploy.yml", "專案設定(核對 repo 與環境)", {
    context: {
      inputs: { environment: "qa" },
      github: { repository: COOKHOME },
    },
    env: deployEnv(),
    cwd: legacyRoot,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /environment/);
  assert.deepEqual(result.outputs, {});
});

test("deploy:換專案設定後,所有命令都指向新專案,沒有任何 CookHome 目標", async () => {
  const job = await runDeploy("staging", {
    repository: "acme/widgets",
    cwd: installScripts(makeProjectRoot()),
  });
  assert.equal(job.failed, null, job.failed?.stderr);
  const all = JSON.stringify([job.calls, job.trace.find(isAuth).with]);
  assert.doesNotMatch(all, /cookhome|728045896207|a0987837233/i);
  assert.match(all, /widgets-api-staging/);
  assert.match(
    all,
    /europe-west1-docker\.pkg\.dev\/acme-widgets\/widgets\/admin:abc1234-staging/,
  );
  assert.equal(exported(job.calls).ROOT_ADMIN_EMAIL, "owner@widgets.example");
});

const AFFECTED_STEP = "受影響的 app(比對該環境目前部署的 SHA)";
function affected(overrides, force = "false") {
  const result = runNamedStep("deploy.yml", AFFECTED_STEP, {
    context: {
      inputs: { force },
      steps: {
        cfg: {
          outputs: {
            region: "asia-east1",
            api_service: "cookhome-api-dev",
            admin_service: "cookhome-admin-dev",
          },
        },
      },
    },
    env: deployEnv({ FAKE_TURBO_AFFECTED: "", ...overrides }),
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}
const flags = (result) => {
  const { api, admin, migrate } = result.outputs;
  return { api, admin, migrate };
};

test("affected:只改專案設定或讀取腳本 → api 與 admin 都重建(turbo 看不到這些檔)", () => {
  for (const file of [
    "deploy/project/cloud.json",
    "deploy/project/github.json",
    "scripts/project-settings/config.mjs",
    "scripts/project-settings/read-config.mjs",
  ]) {
    assert.deepEqual(
      flags(affected({ FAKE_DIFF: `docs/x.md\n${file}\n` })),
      { api: "true", admin: "true", migrate: "true" },
      file,
    );
  }
});

test("affected:runtime env 檔與 deploy.yml 仍只影響 api", () => {
  for (const file of ["deploy/env/dev.yaml", ".github/workflows/deploy.yml"]) {
    assert.deepEqual(
      flags(affected({ FAKE_DIFF: `${file}\n` })),
      { api: "true", admin: "false", migrate: "true" },
      file,
    );
  }
});

test("affected:其餘沿用 turbo 的依賴圖判斷", () => {
  assert.deepEqual(flags(affected({ FAKE_DIFF: "docs/x.md\n" })), {
    api: "false",
    admin: "false",
    migrate: "false",
  });
  assert.deepEqual(
    flags(
      affected({
        FAKE_DIFF: "packages/ui/src/a.ts\n",
        FAKE_TURBO_AFFECTED: "@repo/ui @repo/admin",
      }),
    ),
    { api: "false", admin: "true", migrate: "false" },
  );
  assert.deepEqual(
    flags(
      affected({
        FAKE_DIFF: "apps/db-migrator/x.ts\n",
        FAKE_TURBO_AFFECTED: "@repo/db-migrator",
      }),
    ),
    { api: "false", admin: "false", migrate: "true" },
  );
});

test("affected:以目前部署的 image tag(去掉環境後綴)當 base 比對", () => {
  const result = affected({ FAKE_DIFF: "docs/x.md\n" });
  assert.deepEqual(commands(result.calls, "git"), [
    "git diff --name-only 0ld5ha1...HEAD",
    "git diff --name-only 0ld5ha1...HEAD",
    "git diff --name-only 0ld5ha1...HEAD",
  ]);
});

test("affected:force、首次部署(讀不到 tag)、base 不在歷史 → 全部部署;同一個 SHA → 全部跳過", () => {
  const all = { api: "true", admin: "true", migrate: "true" };
  assert.deepEqual(flags(affected({ FAKE_DIFF: "" }, "true")), all);
  assert.deepEqual(
    flags(affected({ FAKE_API_IMAGE: "", FAKE_ADMIN_IMAGE: "" })),
    all,
  );
  assert.deepEqual(flags(affected({ FAKE_BASE_IN_HISTORY: "0" })), all);
  assert.deepEqual(
    flags(
      affected({
        FAKE_API_IMAGE: "r/api:abc1234",
        FAKE_ADMIN_IMAGE: "r/admin:abc1234-dev",
        FAKE_DIFF: "deploy/project/cloud.json\n",
      }),
    ),
    { api: "false", admin: "false", migrate: "false" },
  );
});

test("affected:判斷腳本壞掉或沒有輸出時保守重建,不會靜默跳過", () => {
  const root = installScripts(makeProjectRoot());
  const result = runNamedStep("deploy.yml", AFFECTED_STEP, {
    context: {
      inputs: { force: "false" },
      steps: {
        cfg: { outputs: { region: "r", api_service: "a", admin_service: "b" } },
      },
    },
    env: deployEnv({ FAKE_DIFF: "docs/x.md\n", FAKE_TURBO_AFFECTED: "" }),
    cwd: path.join(root, "deploy"), // 這裡找不到 scripts/project-settings/deploy-affected.mjs
  });
  assert.equal(result.outputs.api, "true");
  assert.equal(result.outputs.admin, "true");
});

test("只改 API URL(無程式變更):admin 被選中,且 build 的 endpoint 是新值", async () => {
  const cloud = sampleCloud();
  cloud.environments.dev.apiUrl = "https://api-next.widgets.example";
  const job = await runDeploy("dev", {
    repository: "acme/widgets",
    cwd: installScripts(makeProjectRoot({ cloud })),
    env: { FAKE_DIFF: "deploy/project/cloud.json\n", FAKE_TURBO_AFFECTED: "" },
  });
  assert.equal(job.failed, null, job.failed?.stderr);
  const builds = commands(job.calls, "docker").filter((line) =>
    line.includes("admin"),
  );
  assert.match(
    builds[0],
    /--build-arg VITE_GRAPHQL_ENDPOINT=https:\/\/api-next\.widgets\.example\/graphql \.$/,
  );
  assert.doesNotMatch(builds.join("\n"), /api-dev\.widgets\.example/);
});

test("admin 的 endpoint 仍是 Turbo build 雜湊的輸入,Dockerfile 仍以 build-arg 烘入", () => {
  const turbo = JSON.parse(
    readFileSync(path.join(repoRoot, "apps/admin/turbo.json"), "utf8"),
  );
  assert.ok(turbo.tasks.build.env.includes("VITE_GRAPHQL_ENDPOINT"));
  const dockerfile = readFileSync(
    path.join(repoRoot, "apps/admin/Dockerfile"),
    "utf8",
  );
  assert.match(dockerfile, /ARG VITE_GRAPHQL_ENDPOINT/);
  assert.match(dockerfile, /ENV VITE_GRAPHQL_ENDPOINT=\$VITE_GRAPHQL_ENDPOINT/);
});

test("runtime env 仍只有 api 吃:--env-vars-file 只出現在 deploy api,且指向 deploy/env/<環境>.yaml", async () => {
  const withFile = deploySteps.filter((step) =>
    (step.run ?? "").includes("--env-vars-file"),
  );
  assert.deepEqual(
    withFile.map((step) => step.name),
    ["deploy api"],
  );
  const job = await runDeploy("staging");
  const lines = commands(job.calls, "gcloud").filter((line) =>
    line.includes("deploy/env/"),
  );
  assert.equal(lines.length, 1);
  assert.match(
    lines[0],
    /^gcloud run deploy cookhome-api-staging .*--env-vars-file=deploy\/env\/staging\.yaml /,
  );
  for (const environment of ["dev", "staging", "production"]) {
    assert.ok(
      existsSync(path.join(repoRoot, `deploy/env/${environment}.yaml`)),
    );
  }
});

// -------------------------------------------------- shell 特殊字元的安全傳遞

test("值含 shell 特殊字元時原樣成為單一引數:不展開、不分詞、不執行", () => {
  const marker = path
    .join(mkdtempSync(path.join(tmpdir(), "marker-")), "pwned")
    .replaceAll("\\", "/");
  const hostile = `a b;touch ${marker};$(touch ${marker})\`touch ${marker}\`'"*&|>x`;
  const targets = [
    ["deploy.yml", "登入 Artifact Registry"],
    ["deploy.yml", "build + push api"],
    ["deploy.yml", "build + push admin"],
    ["deploy.yml", "deploy api"],
    ["deploy.yml", "deploy admin"],
    ["deploy.yml", "migrate → seed"],
    ["reset-db.yml", "reset"],
  ];
  for (const [workflow, name] of targets) {
    const { step } = findStep(
      parseSteps(readWorkflow(workflow)),
      (candidate) => candidate.name === name,
    );
    const names = Object.keys(step.env);
    assert.ok(names.length > 0, name);
    const run = (value) =>
      runNamedStep(workflow, name, {
        env: {
          ...Object.fromEntries(names.map((key) => [key, value])),
          FAKE_MONGODB_URI: "mongodb://fake-host/fake-db-dev",
        },
      });
    const benign = run("plain");
    const attacked = run(hostile);
    assert.equal(benign.status, 0, `${name}: ${benign.stderr}`);
    assert.equal(attacked.status, 0, `${name}: ${attacked.stderr}`);
    assert.equal(existsSync(marker), false, `${name} 執行了設定值裡的指令`);
    const real = (calls) => calls.filter((call) => call[0] !== "env");
    assert.deepEqual(
      real(attacked.calls).map((call) => call.length),
      real(benign.calls).map((call) => call.length),
      `${name} 的引數個數因特殊字元而改變`,
    );
    assert.ok(
      real(attacked.calls).some((call) =>
        call.some((arg) => arg.includes(hostile)),
      ),
      `${name} 沒有把值原樣傳給命令`,
    );
  }
});

// ---------------------------------------------------------------- reset-db.yml

const resetText = readWorkflow("reset-db.yml");
const resetSteps = parseSteps(resetText);

const runReset = (
  environment,
  mode,
  { repository = COOKHOME, cwd = legacyRoot, uri } = {},
) =>
  runJob("reset-db.yml", {
    inputs: { environment, mode },
    github: { repository },
    env: deployEnv({
      FAKE_MONGODB_URI:
        uri ??
        `mongodb+srv://user:pw@fake-host/cookhome-${environment}?retryWrites=true`,
    }),
    cwd,
  });

test("reset:只能手動、沒有 production 選項、mode 與 GitHub environment 包裝不變", () => {
  assert.match(resetText, /^on:\n {2}workflow_dispatch:\n/m);
  assert.doesNotMatch(
    resetText,
    /^ {2}(push|pull_request|schedule|workflow_run):/m,
  );
  assert.match(resetText, /options: \[dev, staging\]\n/);
  assert.doesNotMatch(resetText, /options: \[[^\]]*production/);
  assert.match(resetText, /options: \[data, full\]/);
  assert.match(
    resetText,
    /^ {4}environment: \$\{\{ inputs\.environment \}\}$/m,
  );
  assert.match(
    resetText,
    /^permissions:\n {2}contents: read\n {2}id-token: write/m,
  );
});

test("reset:讀設定移到 checkout 之後、認證之前", () => {
  const order = (predicate) => findStep(resetSteps, predicate).index;
  const checkout = order((step) =>
    (step.uses ?? "").startsWith("actions/checkout@"),
  );
  const config = order((step) => step.id === "cfg");
  const auth = order(isAuth);
  assert.ok(checkout < config && config < auth);
  assert.match(resetSteps[config].run, /read-config\.mjs --scope cloud /);
});

for (const [environment, mode] of [
  ["dev", "data"],
  ["staging", "full"],
]) {
  test(`reset ${environment} / ${mode}:命令與抽設定前逐字相同,--confirm 取自連線字串的資料庫名`, async () => {
    const job = await runReset(environment, mode);
    assert.equal(job.failed, null, job.failed?.stderr);
    assert.deepEqual(commands(job.calls, "gcloud", "docker", "pnpm"), [
      "pnpm install --frozen-lockfile --filter @repo/db-migrator...",
      `gcloud secrets versions access latest --secret=mongodb-uri-${environment}`,
      `gcloud secrets versions access latest --secret=root-admin-password-${environment}`,
      `pnpm --filter @repo/db-migrator reset --mode=${mode} --confirm=cookhome-${environment}`,
    ]);
    assert.deepEqual(exported(job.calls), {
      MONGODB_URI: `mongodb+srv://user:pw@fake-host/cookhome-${environment}?retryWrites=true`,
      ROOT_ADMIN_PASSWORD: "fake-secret-value",
      ROOT_ADMIN_ACCOUNT: "root",
      ROOT_ADMIN_EMAIL: "a0987837233@gmail.com",
      RESET_ALLOW_ENV: environment,
    });
    assert.deepEqual(job.trace.find(isAuth).with, {
      project_id: "cookhome-online",
      workload_identity_provider:
        "projects/728045896207/locations/global/workloadIdentityPools/github/providers/github-oidc",
      service_account:
        "github-deployer@cookhome-online.iam.gserviceaccount.com",
    });
  });
}

test("reset:production(或任何 dev / staging 以外的值)在第一步就被拒絕,不讀設定、不認證", async () => {
  for (const environment of ["production", "prod", "", "dev staging"]) {
    const job = await runReset(environment, "data");
    assert.equal(job.trace.length, 1, environment);
    assert.equal(job.failed?.label, "環境防呆(只允許 dev / staging)");
    assert.deepEqual(job.calls, []);
  }
});

test("reset:repository 不符時在認證與讀 Secret 之前停止", async () => {
  const job = await runReset("dev", "data", {
    repository: "someone/cookhome-fork",
  });
  assert.equal(job.failed?.label, "專案設定(核對 repo 與環境)");
  assert.equal(job.trace.some(isAuth), false);
  assert.deepEqual(job.calls, []);
});

test("reset:--confirm 永遠帶上、值原樣取自連線字串(未知命名交給指令端的安全閥拒絕),RESET_ALLOW_ENV 只等於所選環境", async () => {
  const { step } = findStep(
    resetSteps,
    (candidate) => candidate.name === "reset",
  );
  assert.equal(step.env.RESET_ALLOW_ENV, "${{ inputs.environment }}");
  assert.match(step.run, /--confirm="\$DB_NAME"/);

  const unknown = await runReset("dev", "data", {
    uri: "mongodb://fake-host/some%2Dother%20db",
  });
  assert.equal(
    commands(unknown.calls, "pnpm").at(-1),
    "pnpm --filter @repo/db-migrator reset --mode=data --confirm=some-other db",
  );
  const production = await runReset("dev", "full", {
    uri: "mongodb://fake-host/cookhome",
  });
  assert.equal(
    commands(production.calls, "pnpm").at(-1),
    "pnpm --filter @repo/db-migrator reset --mode=full --confirm=cookhome",
  );
  assert.equal(exported(production.calls).RESET_ALLOW_ENV, "dev");
  const empty = await runReset("dev", "data", { uri: "mongodb://fake-host/" });
  assert.deepEqual(empty.calls.filter((call) => call[0] === "pnpm").at(-1), [
    "pnpm",
    "--filter",
    "@repo/db-migrator",
    "reset",
    "--mode=data",
    "--confirm=",
  ]);
});

// ---------------------------------------------------------- project-status.yml

const statusText = readWorkflow("project-status.yml");
const statusSteps = parseSteps(statusText);
const require = createRequire(import.meta.url);
const AsyncFunction = (async () => {}).constructor;

function fakeGithub() {
  const mutations = [];
  return {
    mutations,
    graphql: async (query, variables) => {
      mutations.push({ query, variables });
      return { addProjectV2ItemById: { item: { id: `ITEM_${variables.c}` } } };
    },
    rest: {
      issues: {
        get: async ({ issue_number: number }) => ({
          data: { node_id: `NODE_${number}` },
        }),
      },
    },
  };
}

const prOpened = {
  eventName: "pull_request",
  repo: { owner: "acme", repo: "widgets" },
  payload: {
    action: "opened",
    pull_request: {
      draft: false,
      merged: false,
      body: "Closes #7",
      base: { ref: "dev" },
      head: { ref: "feat/evil", sha: "f00", repo: { full_name: "evil/fork" } },
    },
  },
};

/** 模擬 move-card job;github-script 步驟以假 client 執行 workflow 內嵌的腳本。 */
async function runStatus({
  cwd,
  repository = "acme/widgets",
  token = "fake-token",
  context = prOpened,
}) {
  const github = fakeGithub();
  let scriptToken = null;
  const job = await runJob("project-status.yml", {
    github: { repository, event: { repository: { default_branch: "main" } } },
    secrets: { GH_PROJECT_TOKEN: token },
    cwd,
    onUses: async ({ step, env, with: inputs }) => {
      if (!isScript(step)) return;
      scriptToken = inputs["github-token"];
      const saved = { ...process.env };
      Object.assign(process.env, env, { GITHUB_WORKSPACE: cwd });
      try {
        await new AsyncFunction(
          "github",
          "context",
          "require",
          step.with.script,
        )(github, context, require);
      } finally {
        for (const key of Object.keys(process.env)) {
          if (!(key in saved)) delete process.env[key];
        }
        Object.assign(process.env, saved);
      }
    },
  });
  return {
    job,
    github,
    scriptToken,
    scriptRan: job.trace.some((entry) => isScript(entry) && !entry.skipped),
  };
}

test("project-status:觸發事件與權限不變(沒有擴張)", () => {
  assert.match(
    statusText,
    /^on:\n {2}issues:\n {4}types: \[opened, closed\]\n {2}pull_request:\n {4}types: \[opened, reopened, ready_for_review, closed\]\n/m,
  );
  assert.doesNotMatch(statusText, /pull_request_target|workflow_run/);
  assert.match(statusText, /^permissions:\n {2}contents: read\n\n/m);
  assert.doesNotMatch(statusText, /:\s*write\b/);
});

test("project-status:只 checkout 受信任的預設分支,不取 PR head、不留憑證", () => {
  const { step } = findStep(statusSteps, (candidate) =>
    (candidate.uses ?? "").startsWith("actions/checkout@"),
  );
  assert.equal(step.with.ref, "${{ github.event.repository.default_branch }}");
  assert.equal(step.with["persist-credentials"], "false");
  // repository 省略(= 觸發事件所在的 repo)或固定為 github.repository;不得指向 fork 或由事件內容決定
  assert.ok(
    step.with.repository === undefined ||
      step.with.repository === "${{ github.repository }}",
  );
  // checkout 到 workspace 根(不另給 path),後面的步驟才是從這份預設分支內容讀設定與腳本
  for (const key of Object.keys(step.with)) {
    assert.ok(["ref", "persist-credentials", "repository"].includes(key), key);
  }
  assert.equal(
    findStep(statusSteps, (candidate) => candidate === step).index,
    0,
    "checkout 必須是第一步",
  );
  assert.equal(
    statusSteps.filter((candidate) =>
      (candidate.uses ?? "").includes("checkout"),
    ).length,
    1,
  );
  assert.doesNotMatch(
    statusText,
    /head_ref|head\.(ref|sha)|refs\/pull|github\.sha|github\.ref\b/,
  );
});

test("project-status:移卡模組只從 workspace(預設分支的 checkout)載入", async () => {
  const { script } = findStep(statusSteps, isScript).step.with;
  // 內嵌腳本只有一個動態 import,路徑由 GITHUB_WORKSPACE 加固定相對路徑組成;require 只拿 Node 內建模組
  assert.equal(script.match(/\bimport\(/g).length, 1);
  assert.match(
    script,
    /path\.join\(\s*process\.env\.GITHUB_WORKSPACE,\s*"scripts\/project-settings\/project-status\.mjs",?\s*\)/,
  );
  for (const [, name] of script.matchAll(/require\("([^"]+)"\)/g)) {
    assert.match(name, /^node:/);
  }
  assert.doesNotMatch(script, /\$\{\{|https?:|context\.payload/);

  // 行為:把 workspace 裡的模組換成哨兵,實際被執行的就是 workspace 那一份(不是 repo 裡的、也不是別處的)
  const cwd = installScripts(makeProjectRoot());
  writeFileSync(
    path.join(cwd, "scripts/project-settings/project-status.mjs"),
    "export async function runProjectStatus({ config }) { globalThis.__workspaceModuleCalls.push(config); }\n",
  );
  globalThis.__workspaceModuleCalls = [];
  try {
    const { job, github } = await runStatus({ cwd });
    assert.equal(job.failed, null, job.failed?.stderr);
    assert.equal(globalThis.__workspaceModuleCalls.length, 1);
    assert.equal(
      globalThis.__workspaceModuleCalls[0].project_id,
      "PVT_sampleProject",
    );
    assert.deepEqual(github.mutations, []);
  } finally {
    delete globalThis.__workspaceModuleCalls;
  }
});

test("project-status:token 只交給啟用後的看板步驟,讀設定的步驟拿不到", () => {
  const references = statusSteps.flatMap((step) =>
    [...Object.entries(step.env), ...Object.entries(step.with)]
      .filter(([, value]) => value.includes("secrets."))
      .map(([key, value]) => [step.name ?? step.uses, key, value, step.if]),
  );
  assert.deepEqual(references, [
    [
      "看板 token 檢查",
      "HAS_TOKEN",
      "${{ secrets.GH_PROJECT_TOKEN != '' }}",
      "steps.cfg.outputs.enabled == 'true'",
    ],
    [
      findStep(statusSteps, isScript).step.uses,
      "github-token",
      "${{ secrets.GH_PROJECT_TOKEN }}",
      "steps.cfg.outputs.enabled == 'true'",
    ],
  ]);
  for (const step of statusSteps) {
    assert.doesNotMatch(step.run ?? "", /\$\{?(GH_PROJECT_TOKEN|GITHUB_TOKEN)/);
  }
});

test("project-status 啟用:以設定檔的 ID 移卡,事件映射不變(PR 開啟 → In Review)", async () => {
  const cwd = installScripts(makeProjectRoot({ cloud: null }));
  const { job, github, scriptToken, scriptRan } = await runStatus({ cwd });
  assert.equal(job.failed, null, job.failed?.stderr);
  assert.equal(scriptRan, true);
  assert.equal(scriptToken, "fake-token");
  assert.equal(job.trace[0].with.ref, "main");
  assert.deepEqual(
    github.mutations.map((mutation) => mutation.variables),
    [
      { p: "PVT_sampleProject", c: "NODE_7" },
      {
        p: "PVT_sampleProject",
        i: "ITEM_NODE_7",
        f: "PVTSSF_sampleField",
        o: "a0000004",
      },
    ],
  );
});

test("project-status 停用:不需要 cloud.json / IDs / token,看板步驟不執行,零 mutation", async () => {
  const github = {
    schemaVersion: 1,
    expectedRepository: "acme/widgets",
    projectStatus: { enabled: false },
  };
  const cwd = installScripts(makeProjectRoot({ github, cloud: null }));
  const result = await runStatus({ cwd, token: "" });
  assert.equal(result.job.failed, null, result.job.failed?.stderr);
  assert.equal(result.job.steps.cfg.outputs.enabled, "false");
  assert.deepEqual(Object.keys(result.job.steps.cfg.outputs), ["enabled"]);
  assert.equal(result.scriptRan, false);
  assert.equal(result.scriptToken, null);
  assert.deepEqual(result.github.mutations, []);
});

test("project-status 啟用但缺 token(含 fork PR):明確失敗,零 mutation", async () => {
  const cwd = installScripts(makeProjectRoot());
  const result = await runStatus({ cwd, token: "" });
  assert.equal(result.job.failed?.label, "看板 token 檢查");
  assert.match(result.job.failed.stdout, /::error::.*GH_PROJECT_TOKEN/);
  assert.equal(result.scriptRan, false);
  assert.deepEqual(result.github.mutations, []);
});

test("project-status 首次導入:預設分支還沒有設定或讀取器 → 明確失敗、零 mutation,不回退寫死的 ID", async () => {
  const empty = mkdtempSync(path.join(tmpdir(), "default-branch-"));
  const scriptsOnly = installScripts(
    mkdtempSync(path.join(tmpdir(), "default-branch-")),
  );
  const configOnly = makeProjectRoot();
  for (const cwd of [empty, scriptsOnly, configOnly]) {
    const result = await runStatus({ cwd });
    assert.equal(result.job.failed?.label, "專案設定(只讀預設分支)");
    assert.match(result.job.failed.stdout, /::error::.*預設分支.*手動移卡/);
    assert.equal(result.scriptRan, false);
    assert.deepEqual(result.github.mutations, []);
  }
});

test("project-status:repository 不符、啟用但缺 ID、未知 schemaVersion → mutation 前失敗", async () => {
  const noIds = sampleGithub();
  delete noIds.projectStatus.statusFieldId;
  const scenarios = [
    { cwd: installScripts(makeProjectRoot()), repository: "someone/fork" },
    { cwd: installScripts(makeProjectRoot({ github: noIds })) },
    {
      cwd: installScripts(
        makeProjectRoot({ github: { ...sampleGithub(), schemaVersion: 9 } }),
      ),
    },
  ];
  for (const scenario of scenarios) {
    const result = await runStatus(scenario);
    assert.equal(result.job.failed?.label, "專案設定(只讀預設分支)");
    assert.notEqual(result.job.failed.stderr, "");
    assert.equal(result.scriptRan, false);
    assert.deepEqual(result.github.mutations, []);
  }
});

test("project-status:PR 事件內容帶的 head 資訊不影響設定來源(設定只來自工作目錄的預設分支 checkout)", async () => {
  const cwd = installScripts(makeProjectRoot());
  const context = structuredClone(prOpened);
  context.payload.pull_request.head.projectStatus = {
    enabled: true,
    projectId: "PVT_evil",
  };
  context.payload.projectStatus = { projectId: "PVT_evil" };
  const { github, job } = await runStatus({ cwd, context });
  assert.equal(job.trace[0].with.ref, "main");
  assert.equal(github.mutations[0].variables.p, "PVT_sampleProject");
  assert.doesNotMatch(JSON.stringify(github.mutations), /evil/);
});

// ---------------------------------------------------------------- ci.yml

test("ci:有一個不看受影響清單、不需 pnpm install 的專案設定檢查 job,且納入 verify", () => {
  const ci = readWorkflow("ci.yml");
  const start = ci.indexOf("\n  project-settings:\n");
  assert.notEqual(start, -1);
  const rest = ci.slice(start + 1);
  const next = /\n {2}[\w-]+:\n/.exec(rest.slice(1));
  // 去掉註解行(job 結尾接著的是下一個 job 的說明註解)
  const job = rest
    .slice(0, next ? next.index + 1 : undefined)
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
  assert.doesNotMatch(job, /^ {4}needs:/m);
  assert.doesNotMatch(job, /^ {4}if:/m);
  assert.doesNotMatch(job, /pnpm install|turbo/);
  assert.match(job, /node --test scripts\/project-settings\/\*\.test\.mjs/);
  for (const environment of ["dev", "staging", "production"]) {
    assert.match(
      job,
      new RegExp(`--scope cloud --environment ${environment} `),
    );
  }
  assert.match(job, /--scope github /);
  const verify = ci.slice(ci.indexOf("\n  verify:\n"));
  assert.match(verify, /needs:\s*\[[^\]]*project-settings[^\]]*\]/);
});
