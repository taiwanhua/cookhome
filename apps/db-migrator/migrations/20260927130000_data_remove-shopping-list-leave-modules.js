/**
 * data:移除兩個舊的表單模組範例(`shopping-list`、`leave`)與掛在它們底下的全部資料。
 *
 * seed 改宣告三個示範表單模組(`demo-form` / `demo.form` / `demo.sub.form`);seed runner 不刪不認識的文件,
 * 舊模組留在庫裡會一直出現在側欄與角色矩陣,所以在這裡清。整庫重建(`reset-db.yml full`)的環境用不到它,
 * 這支是沒重建的環境的保險。
 *
 * 清的範圍(模組 = 主節點與它底下的隱藏頁,key 為 `<key>` 或 `<key>.` 開頭):
 * - `modules`、`permissions`(seed 的四筆 + wildcard + 表單發布產生的欄位級權限;以 moduleId 與 key 前綴兩路找)
 * - `core_relationships` 的 `role_module` / `role_permission`(角色授予)
 * - `data_scope_targets` / `data_scope_rules`(moduleKey)
 * - `forms`(moduleKey)→ 其 `form_versions`(formKey)、`org_form` / `org_form_workflow`(secondId)
 * - `form_submissions` / `workflow_instances` / `workflow_tasks`(moduleKey)
 * - 流程:只被這兩個模組的表單綁定或使用過的流程(`org_form_workflow.thirdId`、`workflow_instances.workflowKey`),
 *   連同其 `workflow_versions` 與 `org_workflow`。流程本身不屬於任何模組,仍被其他表單綁定或使用的保留
 *
 * 冪等:全部是條件刪除,重跑找不到東西就什麼都不做。刪掉的資料無法還原,`down` 不做事。
 */

/** 兩個 key 都只有小寫英數與 `-`,可以直接放進正規表示式。 */
const RETIRED_MODULE_KEYS = ["shopping-list", "leave"];

function moduleKeyFilter(field) {
  return {
    $or: RETIRED_MODULE_KEYS.flatMap((key) => [
      { [field]: key },
      { [field]: { $regex: `^${key}\\.` } },
    ]),
  };
}

async function idsOf(collection, filter) {
  const documents = await collection
    .find(filter, { projection: { _id: 1 } })
    .toArray();
  return documents.map((document) => document._id);
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  const modules = db.collection("modules");
  const permissions = db.collection("permissions");
  const coreRelationships = db.collection("core_relationships");
  const businessRelationships = db.collection("business_relationships");
  const forms = db.collection("forms");
  const workflows = db.collection("workflows");
  const workflowInstances = db.collection("workflow_instances");

  // 模組樹與權限
  const moduleIds = await idsOf(modules, moduleKeyFilter("key"));
  const permissionIds = await idsOf(permissions, {
    $or: [{ moduleId: { $in: moduleIds } }, moduleKeyFilter("key")],
  });
  await coreRelationships.deleteMany({
    $or: [
      { type: "role_module", secondId: { $in: moduleIds } },
      { type: "role_permission", secondId: { $in: permissionIds } },
    ],
  });
  await permissions.deleteMany({ _id: { $in: permissionIds } });
  await modules.deleteMany({ _id: { $in: moduleIds } });

  // 資料範圍
  await db
    .collection("data_scope_targets")
    .deleteMany(moduleKeyFilter("moduleKey"));
  await db
    .collection("data_scope_rules")
    .deleteMany(moduleKeyFilter("moduleKey"));

  // 流程:先找出候選(被這兩個模組的表單綁定或使用過),再扣掉仍被其他表單綁定或使用的
  const retiredForms = await forms
    .find(moduleKeyFilter("moduleKey"), { projection: { _id: 1, key: 1 } })
    .toArray();
  const formIds = retiredForms.map((form) => form._id);
  const formKeys = retiredForms.map((form) => form.key);

  const boundWorkflowIds = (
    await businessRelationships
      .find(
        { type: "org_form_workflow", secondId: { $in: formIds } },
        { projection: { thirdId: 1 } },
      )
      .toArray()
  ).map((link) => link.thirdId);
  const usedWorkflowKeys = await workflowInstances.distinct(
    "workflowKey",
    moduleKeyFilter("moduleKey"),
  );
  const candidates = await workflows
    .find(
      {
        $or: [
          { _id: { $in: boundWorkflowIds } },
          { key: { $in: usedWorkflowKeys } },
        ],
      },
      { projection: { _id: 1, key: 1 } },
    )
    .toArray();
  const stillBoundIds = new Set(
    (
      await businessRelationships
        .find(
          {
            type: "org_form_workflow",
            secondId: { $nin: formIds },
            thirdId: { $in: candidates.map((workflow) => workflow._id) },
          },
          { projection: { thirdId: 1 } },
        )
        .toArray()
    ).map((link) => String(link.thirdId)),
  );
  const stillUsedKeys = new Set(
    await workflowInstances.distinct("workflowKey", {
      workflowKey: { $in: candidates.map((workflow) => workflow.key) },
      $nor: [moduleKeyFilter("moduleKey")],
    }),
  );
  const retiredWorkflows = candidates.filter(
    (workflow) =>
      !stillBoundIds.has(String(workflow._id)) &&
      !stillUsedKeys.has(workflow.key),
  );
  const workflowIds = retiredWorkflows.map((workflow) => workflow._id);
  const workflowKeys = retiredWorkflows.map((workflow) => workflow.key);

  // 業務關聯、執行期資料、表單與流程本身
  await businessRelationships.deleteMany({
    $or: [
      {
        type: { $in: ["org_form", "org_form_workflow"] },
        secondId: { $in: formIds },
      },
      { type: "org_workflow", secondId: { $in: workflowIds } },
    ],
  });
  await db
    .collection("form_submissions")
    .deleteMany(moduleKeyFilter("moduleKey"));
  await workflowInstances.deleteMany(moduleKeyFilter("moduleKey"));
  await db
    .collection("workflow_tasks")
    .deleteMany(moduleKeyFilter("moduleKey"));
  await db
    .collection("form_versions")
    .deleteMany({ formKey: { $in: formKeys } });
  await forms.deleteMany({ _id: { $in: formIds } });
  await db
    .collection("workflow_versions")
    .deleteMany({ workflowKey: { $in: workflowKeys } });
  await workflows.deleteMany({ _id: { $in: workflowIds } });
};

/**
 * 刪掉的資料無法還原;新模組由 seed 管,不在這裡動。
 * @returns {Promise<void>}
 */
export const down = async () => {};
