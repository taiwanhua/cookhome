/**
 * 夾具 `test/fixtures/reset-managed/` 的共用部分:以真的 update 指令與 api 受管定義 CLI 把兩個版本裝進
 * 拋棄式資料庫、補上「現場才有」的資料(草稿、畫面自建、租戶客製、分派與案件),以及讀最終狀態的工具。
 */
import { expect } from "@jest/globals";
import { type Document, ObjectId } from "mongodb";

import { MANAGED_V1, MANAGED_V2 } from "./reset-harness";
import { documentsOf, runUpdate, withDatabase } from "./update-harness";

export const ORDER = "reset_order";
export const LEAVING = "reset_leaving";
export const ARCHIVED = "reset_archived";
export const REVIEW = "reset_review";
export const UI_BUILT = "ui_built";
export const ORDER_FORK = "reset_order_tenant";
export const REVIEW_FORK = "reset_review_tenant";

/** 訂購單的三筆欄位級權限(第二版起「備註可見」已退役)與退出登記那張表單的一筆。 */
export const ORDER_PERMISSIONS = [
  "project-form.edit-reset_order-amount",
  "project-form.show-reset_order-amount",
  "project-form.show-reset_order-note",
];
export const LEAVING_PERMISSION = "project-form.show-reset_leaving-memo";
export const UI_BUILT_PERMISSION = "project-form.show-ui_built-secret";

/** 第一版:訂購單初版、審核流程、之後退出登記的表單、明示退役的表單(全部由 api 的 CLI 真的發布)。 */
export async function installV1(databaseUri: string): Promise<void> {
  const result = await runUpdate(databaseUri, [MANAGED_V1]);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
}

/** 第二版:訂購單發布第二版(第一版自動退役、備註的權限退役);`reset_leaving` 不再登記。 */
export async function installV2(databaseUri: string): Promise<void> {
  const result = await runUpdate(databaseUri, [MANAGED_V2]);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
}

async function idOf(
  databaseUri: string,
  collection: string,
  key: string,
): Promise<ObjectId> {
  const [document] = await documentsOf(databaseUri, collection, { key });
  if (document === undefined) {
    throw new Error(`${collection} 沒有 ${key}`);
  }
  return document._id as ObjectId;
}

const stamps = () => ({ createdAt: new Date(), updatedAt: new Date() });

const link = (type: string, firstId: ObjectId, secondId: ObjectId) => ({
  type,
  firstId,
  secondId,
  thirdId: null,
  ...stamps(),
});

/**
 * 現場才有、`data` reset 應該清掉的東西(受管定義本身是上面兩步真的發布出來的,這裡不碰):
 * 受管表單與流程的設計草稿、畫面自建而未登記的共用表單與它的權限、租戶的客製表單 / 流程、
 * 租戶組織與角色、表單分派、提交與流程實例 / 任務;另外讓種子角色與租戶角色各拿到一些欄位級權限。
 */
export async function insertFieldData(databaseUri: string): Promise<void> {
  const orderId = await idOf(databaseUri, "forms", ORDER);
  const projectFormId = await idOf(databaseUri, "modules", "project-form");
  const seedRoleId = await idOf(databaseUri, "roles", "super-admin");
  const orderShowId = await idOf(
    databaseUri,
    "permissions",
    "project-form.show-reset_order-amount",
  );
  const [leavingPermission] = await documentsOf(databaseUri, "permissions", {
    key: LEAVING_PERMISSION,
  });
  await withDatabase(databaseUri, async (database) => {
    const { insertedId: tenantId } = await database
      .collection("orgs")
      .insertOne({
        name: "人建的租戶",
        enabled: true,
        isSystem: false,
        ...stamps(),
      });
    const { insertedId: tenantRoleId } = await database
      .collection("roles")
      .insertOne({
        name: "租戶管理員",
        enabled: true,
        isSystem: false,
        ...stamps(),
      });
    await database.collection("form_versions").insertMany([
      // 受管表單的現場草稿
      {
        formKey: ORDER,
        version: null,
        status: "draft",
        draftRevision: 3,
        baseVersion: 2,
        fields: [],
        ...stamps(),
      },
      {
        formKey: UI_BUILT,
        version: 1,
        status: "published",
        fields: [],
        ...stamps(),
      },
      {
        formKey: ORDER_FORK,
        version: 1,
        status: "published",
        fields: [],
        ...stamps(),
      },
    ]);
    await database.collection("forms").insertMany([
      {
        key: UI_BUILT,
        moduleKey: "project-form",
        name: "畫面上自建、沒有登記的表單",
        ownerOrgId: null,
        forkedFrom: null,
        currentVersion: 1,
        ...stamps(),
      },
      {
        key: ORDER_FORK,
        moduleKey: "project-form",
        name: "租戶客製的訂購單",
        ownerOrgId: tenantId,
        forkedFrom: { formKey: ORDER, version: 2 },
        currentVersion: 1,
        ...stamps(),
      },
    ]);
    await database.collection("workflow_versions").insertMany([
      {
        workflowKey: REVIEW,
        version: null,
        status: "draft",
        draftRevision: 1,
        baseVersion: 1,
        steps: [],
        ...stamps(),
      },
      {
        workflowKey: REVIEW_FORK,
        version: 1,
        status: "published",
        steps: [],
        ...stamps(),
      },
    ]);
    await database.collection("workflows").insertOne({
      key: REVIEW_FORK,
      name: "租戶客製的審核流程",
      ownerOrgId: tenantId,
      tenantId,
      forkedFrom: { workflowKey: REVIEW, version: 1 },
      currentVersion: 1,
      ...stamps(),
    });
    const { insertedId: uiPermissionId } = await database
      .collection("permissions")
      .insertOne({
        key: UI_BUILT_PERMISSION,
        moduleId: projectFormId,
        name: "自建表單 / 機密 可見",
        enabled: true,
        isSystem: false,
        settings: {},
        source: "dynamic",
        retiredAt: null,
        ...stamps(),
      });
    await database.collection("core_relationships").insertMany([
      // 種子角色拿到受管表單的欄位級權限:reset 後這筆授權要還在(權限 id 不變才接得上)
      link("role_permission", seedRoleId, orderShowId),
      link("role_permission", tenantRoleId, orderShowId),
      link("role_permission", seedRoleId, uiPermissionId),
      ...(leavingPermission === undefined
        ? []
        : [
            link(
              "role_permission",
              seedRoleId,
              leavingPermission._id as ObjectId,
            ),
          ]),
      link("org_role", tenantId, tenantRoleId),
    ]);
    await database.collection("business_relationships").insertOne({
      type: "org_form",
      tenantId,
      firstId: tenantId,
      secondId: orderId,
      ...stamps(),
    });
    const submissionId = new ObjectId();
    const instanceId = new ObjectId();
    await database.collection("form_submissions").insertOne({
      _id: submissionId,
      orgId: tenantId,
      tenantId,
      formKey: ORDER,
      moduleKey: "project-form",
      version: 2,
      status: "in_review",
      clientRequestId: "reset-order-in-review",
      values: { title: "審核中的訂購" },
      currentInstanceId: instanceId,
      ...stamps(),
    });
    await database.collection("workflow_instances").insertOne({
      _id: instanceId,
      tenantId,
      workflowKey: REVIEW,
      workflowVersion: 1,
      submissionId,
      status: "running",
      ...stamps(),
    });
    await database.collection("workflow_tasks").insertOne({
      tenantId,
      instanceId,
      taskKey: "boss:1",
      status: "pending",
      ...stamps(),
    });
    // 人在後台改過的根組織名稱(data reset 要保留現值)
    await database
      .collection("orgs")
      .updateOne({ key: "root" }, { $set: { name: "現場改過的營運中心" } });
  });
}

/** 受管定義保留閉包涉及的六張表(依穩定順序),供前後對照。 */
export interface DefinitionState {
  forms: Document[];
  formVersions: Document[];
  workflows: Document[];
  workflowVersions: Document[];
  installations: Document[];
  dynamicPermissions: Document[];
}

export async function definitionStateOf(
  databaseUri: string,
): Promise<DefinitionState> {
  return {
    forms: await documentsOf(databaseUri, "forms", {}, "key"),
    formVersions: await documentsOf(databaseUri, "form_versions"),
    workflows: await documentsOf(databaseUri, "workflows", {}, "key"),
    workflowVersions: await documentsOf(databaseUri, "workflow_versions"),
    installations: await documentsOf(
      databaseUri,
      "seed_definition_installations",
    ),
    dynamicPermissions: await documentsOf(
      databaseUri,
      "permissions",
      { source: "dynamic" },
      "key",
    ),
  };
}

/** `<key>@<版號>:<狀態>`(草稿的版號是 null),依字典序。 */
export function versionLabels(
  versions: readonly Document[],
  keyField: "formKey" | "workflowKey",
): string[] {
  return versions
    .map(
      (version) =>
        `${String(version[keyField])}@${String(version.version)}:${String(version.status)}`,
    )
    .toSorted((left, right) => left.localeCompare(right, "zh-Hant"));
}

/** `<key>@<revision>→<本地版號>`,依字典序。 */
export function installationLabels(
  installations: readonly Document[],
): string[] {
  return installations
    .map(
      (item) =>
        `${String(item.key)}@${String(item.revision)}→${String(item.localVersion)}`,
    )
    .toSorted((left, right) => left.localeCompare(right, "zh-Hant"));
}
