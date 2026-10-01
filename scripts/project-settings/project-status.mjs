/**
 * 看板移卡(規則正本:docs/agents/issue-tracker.md「看板:票的生命週期」)。
 * 由 project-status.yml 的 github-script 步驟從「預設分支的 checkout」載入;看板識別由呼叫端傳入
 * (來源是 deploy/project/github.json,經 read-config.mjs 驗證),本檔不寫死任何 ID、不讀事件內容裡的設定。
 *
 *   issue opened                          → Backlog
 *   issue closed                          → Released(以 not planned 關閉者 → Won't Do)
 *   PR 開啟(目標 dev,內文 Closes #n)       → #n → In Review
 *   PR 合進 dev(內文 Closes #n)            → #n → Dev 驗證中
 *   PR 合進 staging(內文 Closes/Refs #n)   → #n → Staging 驗證中
 * 不自動:Ready、In Progress、Dev / Staging 通過、release 關票。
 */

/** 自動化負責寫入的六個狀態(github.json 的 options 另有四個只由人移動)。 */
export const AUTOMATED_STATUS_KEYS = [
  "backlog",
  "review",
  "devVerify",
  "stagingVerify",
  "released",
  "wontDo",
];

export function linkedIssueNumbers(body) {
  const re = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?)\s+#(\d+)/gi;
  const nums = new Set();
  for (const m of (body ?? "").matchAll(re)) nums.add(Number(m[1]));
  return [...nums];
}

const isText = (value) => typeof value === "string" && value !== "";

/** 啟用時必要的識別缺一不可;在任何 API 呼叫之前檢查。 */
function assertBoardConfig(config) {
  const complete =
    config?.enabled === true &&
    isText(config.project_id) &&
    isText(config.status_field_id) &&
    AUTOMATED_STATUS_KEYS.every((key) => isText(config.options?.[key]));
  if (!complete) {
    throw new Error(
      "看板設定不完整(需要 project_id、status_field_id 與自動化用到的六個 options);本次不移卡",
    );
  }
}

/**
 * 依事件移卡。`config` 是 read-config.mjs `--scope github` 的輸出;
 * `enabled` 為 false 時直接結束,不做任何讀取或寫入。
 */
export async function runProjectStatus({ github, context, config }) {
  if (config?.enabled === false) return;
  assertBoardConfig(config);
  const { project_id: projectId, status_field_id: fieldId, options } = config;

  async function setStatus(contentNodeId, optionId) {
    const add = await github.graphql(
      `mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item { id } } }`,
      { p: projectId, c: contentNodeId },
    );
    const itemId = add.addProjectV2ItemById.item.id;
    await github.graphql(
      `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){
         updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ projectV2Item { id } }
       }`,
      { p: projectId, i: itemId, f: fieldId, o: optionId },
    );
  }

  async function issueNodeId(num) {
    const { data } = await github.rest.issues.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: num,
    });
    return data.node_id;
  }

  if (context.eventName === "issues") {
    const issue = context.payload.issue;
    if (context.payload.action === "opened") {
      await setStatus(issue.node_id, options.backlog);
    } else if (context.payload.action === "closed") {
      const opt =
        issue.state_reason === "not_planned"
          ? options.wontDo
          : options.released;
      await setStatus(issue.node_id, opt);
    }
    return;
  }

  const pr = context.payload.pull_request;
  if (pr.draft) return;
  const base = pr.base.ref;
  const nums = linkedIssueNumbers(pr.body);
  if (nums.length === 0) return;

  let optionId = null;
  if (
    ["opened", "reopened", "ready_for_review"].includes(
      context.payload.action,
    ) &&
    base === "dev"
  ) {
    optionId = options.review;
  } else if (context.payload.action === "closed" && pr.merged) {
    if (base === "dev") optionId = options.devVerify;
    else if (base === "staging") optionId = options.stagingVerify;
  }
  if (!optionId) return;

  for (const num of nums) {
    await setStatus(await issueNodeId(num), optionId);
  }
}
