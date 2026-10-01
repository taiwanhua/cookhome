import assert from "node:assert/strict";
import { test } from "node:test";

import { isDeployAffected } from "./deploy-affected.mjs";
import { runScript } from "./test-support.mjs";

const API = "@repo/api";
const ADMIN = "@repo/admin";
const MIGRATOR = "@repo/db-migrator";

test("專案設定或讀取腳本有變:api 與 admin 都要重建", () => {
  for (const file of [
    "deploy/project/cloud.json",
    "deploy/project/github.json",
    "scripts/project-settings/config.mjs",
    "scripts/project-settings/read-config.mjs",
    "scripts/project-settings/write-github-output.mjs",
  ]) {
    assert.equal(isDeployAffected(API, [file]), true, file);
    assert.equal(isDeployAffected(ADMIN, [file]), true, file);
  }
});

test("runtime env 檔與 deploy.yml 只影響 api(admin 的設定烘在 image)", () => {
  for (const file of [
    "deploy/env/dev.yaml",
    "deploy/env/production.yaml",
    ".github/workflows/deploy.yml",
  ]) {
    assert.equal(isDeployAffected(API, [file]), true, file);
    assert.equal(isDeployAffected(ADMIN, [file]), false, file);
  }
});

test("其他路徑不由本規則判定(交給 turbo 的依賴圖)", () => {
  const files = [
    "apps/admin/src/main.tsx",
    "docs/deployment.md",
    "deploy/projectx/cloud.json",
    "other/deploy/project/cloud.json",
    "scripts/claude-hooks/post-edit-check.mjs",
    ".github/workflows/reset-db.yml",
    "",
  ];
  for (const name of [API, ADMIN, MIGRATOR]) {
    assert.equal(isDeployAffected(name, files), false, name);
  }
  assert.equal(
    isDeployAffected(MIGRATOR, ["deploy/project/cloud.json"]),
    false,
  );
});

test("CLI:stdin 收 git diff --name-only 的清單,stdout 只印 true / false", () => {
  const run = (name, input) =>
    runScript("deploy-affected.mjs", [name], { input });
  assert.equal(
    run(ADMIN, "docs/a.md\ndeploy/project/cloud.json\n").stdout,
    "true\n",
  );
  assert.equal(run(ADMIN, "deploy/env/dev.yaml\r\n").stdout, "false\n");
  assert.equal(run(API, "deploy/env/dev.yaml\r\n").stdout, "true\n");
  assert.equal(run(API, "").stdout, "false\n");
  const missing = runScript("deploy-affected.mjs", [], { input: "" });
  assert.notEqual(missing.status, 0);
  assert.equal(missing.stdout, "");
});
