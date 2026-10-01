import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveGithubConfig } from "./config.mjs";
import {
  AUTOMATED_STATUS_KEYS,
  linkedIssueNumbers,
  runProjectStatus,
} from "./project-status.mjs";
import {
  LEGACY_COOKHOME_REPOSITORY,
  makeLegacyCookhomeRoot,
  makeProjectRoot,
} from "./test-support.mjs";

const board = resolveGithubConfig({
  rootDir: makeProjectRoot(),
  repository: "acme/widgets",
});

/** 假 GitHub client:記錄每一次 GraphQL 呼叫(都是 mutation)與 REST 讀取,不連網。 */
function fakeGithub() {
  const mutations = [];
  const reads = [];
  return {
    mutations,
    reads,
    graphql: async (query, variables) => {
      mutations.push({ query, variables });
      if (query.includes("addProjectV2ItemById")) {
        return {
          addProjectV2ItemById: { item: { id: `ITEM_${variables.c}` } },
        };
      }
      return {
        updateProjectV2ItemFieldValue: { projectV2Item: { id: variables.i } },
      };
    },
    rest: {
      issues: {
        get: async (params) => {
          reads.push(params);
          return { data: { node_id: `NODE_${params.issue_number}` } };
        },
      },
    },
  };
}

const repo = { owner: "acme", repo: "widgets" };
const issueEvent = (action, issue = {}) => ({
  eventName: "issues",
  repo,
  payload: { action, issue: { node_id: "NODE_issue", ...issue } },
});
const prEvent = (action, pullRequest) => ({
  eventName: "pull_request",
  repo,
  payload: {
    action,
    pull_request: {
      draft: false,
      merged: false,
      body: "Closes #12",
      base: { ref: "dev" },
      ...pullRequest,
    },
  },
});

/** 回傳每張被移動的卡:[內容 node id, option id]。 */
async function moves(context, config = board) {
  const github = fakeGithub();
  await runProjectStatus({ github, context, config });
  assert.equal(github.mutations.length % 2, 0);
  const result = [];
  for (let index = 0; index < github.mutations.length; index += 2) {
    const add = github.mutations[index];
    const update = github.mutations[index + 1];
    assert.match(add.query, /addProjectV2ItemById/);
    assert.match(update.query, /updateProjectV2ItemFieldValue/);
    assert.deepEqual(add.variables, {
      p: config.project_id,
      c: add.variables.c,
    });
    assert.deepEqual(update.variables, {
      p: config.project_id,
      i: `ITEM_${add.variables.c}`,
      f: config.status_field_id,
      o: update.variables.o,
    });
    result.push([add.variables.c, update.variables.o]);
  }
  return result;
}

const SIX_MAPPINGS = [
  ["issue opened → Backlog", issueEvent("opened"), "backlog", "NODE_issue"],
  [
    "issue closed(completed)→ Released",
    issueEvent("closed", { state_reason: "completed" }),
    "released",
    "NODE_issue",
  ],
  [
    "issue closed(not planned)→ Won't Do",
    issueEvent("closed", { state_reason: "not_planned" }),
    "wontDo",
    "NODE_issue",
  ],
  ["PR 開啟(目標 dev)→ In Review", prEvent("opened", {}), "review", "NODE_12"],
  [
    "PR 合進 dev → Dev 驗證中",
    prEvent("closed", { merged: true }),
    "devVerify",
    "NODE_12",
  ],
  [
    "PR 合進 staging → Staging 驗證中",
    prEvent("closed", {
      merged: true,
      base: { ref: "staging" },
      body: "Refs #12",
    }),
    "stagingVerify",
    "NODE_12",
  ],
];

for (const [title, context, key, node] of SIX_MAPPINGS) {
  test(`自動映射:${title}`, async () => {
    assert.deepEqual(await moves(context), [[node, board.options[key]]]);
  });
}

test("自動化只負責六個狀態;其餘四個(Ready / In Progress / Dev 通過 / Staging 通過)永不被寫入", async () => {
  assert.deepEqual(AUTOMATED_STATUS_KEYS, [
    "backlog",
    "review",
    "devVerify",
    "stagingVerify",
    "released",
    "wontDo",
  ]);
  const used = new Set();
  for (const [, context] of SIX_MAPPINGS) {
    for (const [, option] of await moves(context)) used.add(option);
  }
  assert.deepEqual(
    [...used].sort(),
    AUTOMATED_STATUS_KEYS.map((key) => board.options[key]).sort(),
  );
  for (const manual of ["ready", "inProgress", "devPassed", "stagingPassed"]) {
    assert.ok(board.options[manual]);
    assert.ok(!used.has(board.options[manual]));
  }
});

test("PR reopened / ready_for_review(目標 dev)同樣 → In Review", async () => {
  for (const action of ["reopened", "ready_for_review"]) {
    assert.deepEqual(await moves(prEvent(action, {})), [
      ["NODE_12", board.options.review],
    ]);
  }
});

test("PR 內文多張票:每張各移一次,重複票號只算一次", async () => {
  const context = prEvent("closed", {
    merged: true,
    body: "Closes #12\nfixes #34, Resolves #12 and refs #56",
  });
  assert.deepEqual(await moves(context), [
    ["NODE_12", board.options.devVerify],
    ["NODE_34", board.options.devVerify],
    ["NODE_56", board.options.devVerify],
  ]);
});

test("不移卡的事件:零 mutation", async () => {
  const quiet = [
    prEvent("opened", { draft: true }),
    prEvent("opened", { body: "沒有票號" }),
    prEvent("opened", { body: null }),
    prEvent("opened", { base: { ref: "staging" } }),
    prEvent("opened", { base: { ref: "main" } }),
    prEvent("closed", { merged: false }),
    prEvent("closed", { merged: true, base: { ref: "main" } }),
    issueEvent("reopened"),
  ];
  for (const context of quiet) {
    assert.deepEqual(await moves(context), []);
  }
});

test("linkedIssueNumbers:Closes / Fixes / Resolves / Refs 的各種時態,不分大小寫", () => {
  assert.deepEqual(
    linkedIssueNumbers(
      "close #1 closes #2 closed #3 fix #4 fixes #5 fixed #6 resolve #7 resolves #8 resolved #9 ref #10 REFS #11",
    ),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  );
  assert.deepEqual(linkedIssueNumbers("see #5, related to #6"), []);
  assert.deepEqual(linkedIssueNumbers(undefined), []);
});

test("看板停用:任何事件都零讀取、零 mutation", async () => {
  for (const [, context] of SIX_MAPPINGS) {
    const github = fakeGithub();
    await runProjectStatus({ github, context, config: { enabled: false } });
    assert.equal(github.mutations.length, 0);
    assert.equal(github.reads.length, 0);
  }
});

test("啟用但設定不完整:在任何 API 呼叫之前明確失敗", async () => {
  const withoutOption = structuredClone(board);
  delete withoutOption.options.devVerify;
  const broken = [
    undefined,
    {},
    { enabled: "true" },
    { ...board, project_id: "" },
    { ...board, status_field_id: undefined },
    { ...board, options: undefined },
    withoutOption,
  ];
  for (const config of broken) {
    for (const [, context] of SIX_MAPPINGS) {
      const github = fakeGithub();
      await assert.rejects(
        runProjectStatus({ github, context, config }),
        /看板設定/,
      );
      assert.equal(github.mutations.length, 0);
      assert.equal(github.reads.length, 0);
    }
  }
});

test("CookHome 相容性夾具下的六個自動映射與原 workflow 寫死的 option ID 相同", async () => {
  const real = resolveGithubConfig({
    rootDir: makeLegacyCookhomeRoot(),
    repository: LEGACY_COOKHOME_REPOSITORY,
  });
  const original = {
    backlog: "2882aeb7",
    review: "43e18a1a",
    devVerify: "0eaa8179",
    stagingVerify: "e94980d1",
    released: "e3445e43",
    wontDo: "b6b968cd",
  };
  for (const [, context, key] of SIX_MAPPINGS) {
    const [[, option]] = await moves(context, real);
    assert.equal(option, original[key]);
  }
});
