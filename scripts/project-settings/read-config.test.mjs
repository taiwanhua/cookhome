import assert from "node:assert/strict";
import { test } from "node:test";

import { CLOUD_OUTPUT_KEYS } from "./config.mjs";
import {
  liveRepository,
  makeProjectRoot,
  repoRoot,
  runScript,
  sampleCloud,
  sampleGithub,
} from "./test-support.mjs";

const REPO = "acme/widgets";
const cli = (args, options) => runScript("read-config.mjs", args, options);

/** 失敗協定:非零退出、stdout 完全沒有輸出、stderr 有單行說明。 */
function assertFailure(result, pattern) {
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, pattern);
}

test("cloud scope:stdout 只有一個 JSON 物件(單行),鍵固定,stderr 無輸出", () => {
  const result = cli(
    ["--scope", "cloud", "--environment", "dev", "--repository", REPO],
    { cwd: makeProjectRoot() },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^\{[^\n]*\}\n$/);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(parsed), CLOUD_OUTPUT_KEYS);
  assert.equal(parsed.api_service, "widgets-api-dev");
  assert.equal(parsed.api_url, "https://api-dev.widgets.example");
  assert.equal(parsed.root_email, "owner@widgets.example");
});

test("正式設定 dry-run:以目前 repo 身分跑兩個入口皆成功(只驗 schema 與鍵,不驗專案值)", () => {
  const repository = liveRepository();
  for (const environment of ["dev", "staging", "production"]) {
    const result = cli(
      [
        "--scope",
        "cloud",
        "--environment",
        environment,
        "--repository",
        repository,
      ],
      { cwd: repoRoot },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(Object.keys(JSON.parse(result.stdout)), CLOUD_OUTPUT_KEYS);
  }
  const board = cli(["--scope", "github", "--repository", repository], {
    cwd: repoRoot,
  });
  assert.equal(board.status, 0, board.stderr);
  assert.equal(typeof JSON.parse(board.stdout).enabled, "boolean");
});

test("argv 夾帶換行或 workflow 指令:stdout 空、非零、stderr 單行且不含控制字元與注入內容", () => {
  const cwd = makeProjectRoot();
  const payloads = [
    "bad\n::warning::injected",
    "bad\r\n::error::injected",
    `bad${String.fromCodePoint(0x2028)}::add-mask::injected`, // Unicode 行分隔符
    "bad\u001b[31m::notice::injected",
    "--bad\n::warning::injected",
  ];
  const shapes = [
    (payload) => [payload],
    (payload) => [payload, "value"],
    (payload) => ["--scope", payload, "--repository", REPO],
    (payload) => ["--scope", "github", "--repository", payload],
    (payload) => ["--scope", "github", "--repository", REPO, payload],
    (payload) => [
      "--scope",
      "cloud",
      "--environment",
      payload,
      "--repository",
      REPO,
    ],
    (payload) => [
      "--scope",
      "github",
      "--repository",
      REPO,
      "--scope",
      payload,
    ],
  ];
  for (const payload of payloads) {
    for (const shape of shapes) {
      const result = cli(shape(payload), { cwd });
      const label = JSON.stringify(shape(payload));
      assert.notEqual(result.status, 0, label);
      assert.equal(result.stdout, "", label);
      assert.match(result.stderr, /^project-settings: [^\n]+\n$/, label);
      assert.doesNotMatch(
        result.stderr.slice(0, -1),
        /[\p{Cc}\p{Zl}\p{Zp}]/u,
        label,
      );
      assert.doesNotMatch(result.stderr, /injected|::\w+::/, label);
    }
  }
});

test("github scope:啟用時輸出 enabled / project_id / status_field_id / options", () => {
  const result = cli(["--scope", "github", "--repository", REPO], {
    cwd: makeProjectRoot({ cloud: null }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^\{[^\n]*\}\n$/);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(parsed), [
    "enabled",
    "project_id",
    "status_field_id",
    "options",
  ]);
  assert.equal(parsed.enabled, true);
  assert.equal(Object.keys(parsed.options).length, 10);
});

test("github scope:停用時只輸出 enabled=false,不需要 cloud.json、IDs 或 token", () => {
  const github = {
    schemaVersion: 1,
    expectedRepository: REPO,
    projectStatus: { enabled: false },
  };
  const result = cli(["--scope", "github", "--repository", REPO], {
    cwd: makeProjectRoot({ github, cloud: null }),
    env: { GH_PROJECT_TOKEN: "", GITHUB_TOKEN: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '{"enabled":false}\n');
});

test("github scope 不接受 --environment(不讓看板借用假的部署環境)", () => {
  assertFailure(
    cli(["--scope", "github", "--environment", "dev", "--repository", REPO], {
      cwd: makeProjectRoot(),
    }),
    /--environment/,
  );
});

test("參數錯誤:缺 scope、未知 scope、缺 repository、缺 environment、未知旗標、缺值、重複", () => {
  const cwd = makeProjectRoot();
  const cases = [
    [[], /--scope/],
    [["--scope", "all", "--repository", REPO], /--scope/],
    [["--scope", "cloud", "--environment", "dev"], /--repository/],
    [["--scope", "github"], /--repository/],
    [["--scope", "cloud", "--repository", REPO], /--environment/],
    [
      ["--scope", "github", "--repository", REPO, "--config", "x"],
      /未知的參數/,
    ],
    [["--scope", "github", "--repository"], /--repository/],
    [["--scope", "github", "--repository", REPO, "extra"], /未知的參數/],
    [
      ["--scope", "github", "--repository", REPO, "--repository", "x/y"],
      /--repository/,
    ],
  ];
  for (const [args, pattern] of cases) {
    assertFailure(cli(args, { cwd }), pattern);
  }
});

test("repository 不符:非零退出、stdout 無任何設定值", () => {
  const cwd = makeProjectRoot();
  assertFailure(
    cli(
      ["--scope", "cloud", "--environment", "dev", "--repository", "evil/fork"],
      {
        cwd,
      },
    ),
    /repository/,
  );
  assertFailure(
    cli(["--scope", "github", "--repository", "evil/fork"], { cwd }),
    /repository/,
  );
});

test("未知環境、未知 schemaVersion、缺值、檔案不存在皆失敗且 stdout 為空", () => {
  assertFailure(
    cli(["--scope", "cloud", "--environment", "qa", "--repository", REPO], {
      cwd: makeProjectRoot(),
    }),
    /environment/,
  );
  assertFailure(
    cli(["--scope", "github", "--repository", REPO], {
      cwd: makeProjectRoot({ github: { ...sampleGithub(), schemaVersion: 2 } }),
    }),
    /schemaVersion/,
  );
  const cloud = sampleCloud();
  delete cloud.environments.staging.secrets.jwtSecret;
  assertFailure(
    cli(["--scope", "cloud", "--environment", "dev", "--repository", REPO], {
      cwd: makeProjectRoot({ cloud }),
    }),
    /environments\.staging\.secrets\.jwtSecret/,
  );
  assertFailure(
    cli(["--scope", "github", "--repository", REPO], {
      cwd: makeProjectRoot({ github: null }),
    }),
    /github\.json/,
  );
  assertFailure(
    cli(["--scope", "cloud", "--environment", "dev", "--repository", REPO], {
      cwd: makeProjectRoot({ cloud: null }),
    }),
    /cloud\.json/,
  );
});

test("含換行的設定值:失敗,stderr 是單行且不回印該值(不能夾帶 workflow 指令)", () => {
  const cloud = sampleCloud();
  cloud.environments.dev.secrets.mongodbUri = "db-uri\n::add-mask::oops";
  const result = cli(
    ["--scope", "cloud", "--environment", "dev", "--repository", REPO],
    { cwd: makeProjectRoot({ cloud }) },
  );
  assertFailure(result, /environments\.dev\.secrets\.mongodbUri/);
  assert.doesNotMatch(result.stderr, /add-mask|oops/);
  assert.equal(result.stderr.trimEnd().split("\n").length, 1);
});

test("含 shell 特殊字元的自由文字欄位:以 JSON 字串原樣輸出,仍是單行單一物件", () => {
  const cloud = sampleCloud();
  cloud.environments.dev.rootAdmin.account = `o'w"ner $(id) \`id\` ;x \\ end`;
  const result = cli(
    ["--scope", "cloud", "--environment", "dev", "--repository", REPO],
    { cwd: makeProjectRoot({ cloud }) },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\{[^\n]*\}\n$/);
  assert.equal(
    JSON.parse(result.stdout).root_account,
    `o'w"ner $(id) \`id\` ;x \\ end`,
  );
});

test("讀取器不讀也不印任何機密:環境裡的 token / 連線字串不出現在輸出", () => {
  const env = {
    GH_PROJECT_TOKEN: "ghp_fake_token_value",
    MONGODB_URI: "mongodb://user:fake-password@host/db",
    ROOT_ADMIN_PASSWORD: "fake-root-password",
  };
  for (const args of [
    ["--scope", "cloud", "--environment", "production", "--repository", REPO],
    ["--scope", "github", "--repository", REPO],
    ["--scope", "github", "--repository", "evil/fork"],
  ]) {
    const result = cli(args, { cwd: makeProjectRoot(), env });
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /ghp_fake|fake-password|fake-root-password/,
    );
  }
});
