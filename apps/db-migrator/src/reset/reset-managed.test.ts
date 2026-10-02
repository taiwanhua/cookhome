import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { Document, ObjectId } from "mongodb";

import {
  MANAGED_V2,
  RESET_MARKER,
  dumpApplicationData,
  runReset,
} from "../../test/support/reset-harness";
import {
  ARCHIVED,
  LEAVING,
  LEAVING_PERMISSION,
  ORDER,
  ORDER_PERMISSIONS,
  REVIEW,
  definitionStateOf,
  insertFieldData,
  installV1,
  installV2,
  installationLabels,
  versionLabels,
} from "../../test/support/reset-managed";
import {
  TICKET,
  TICKET_V2,
  V1,
  V3,
  insertV1Data,
} from "../../test/support/update-evolve";
import {
  BUILD_TIMEOUT_MS,
  TestMongo,
  buildDefinitionCli,
  changelogOf,
  documentsOf,
  journalOf,
  lockOf,
  runUpdate,
  runUpdateWithFault,
} from "../../test/support/update-harness";

/**
 * `data` reset 的受管定義保留閉包(`docs/concepts/data-layer-and-isolation.md` 「還原」):
 * 真的拋棄式 MongoDB、真的 update / reset 指令子行程、真的 api 受管定義 CLI(定義是發布出來的,不是插進去的)。
 * 夾具 `test/fixtures/reset-managed/`。
 */

const mongo = new TestMongo("db-migrator-reset-managed");

beforeAll(async () => {
  await mongo.start();
  await buildDefinitionCli();
}, BUILD_TIMEOUT_MS);

afterAll(async () => {
  await mongo.stop();
}, 60_000);

const idsOf = (documents: readonly Document[]): string[] =>
  documents.map((document) => String(document._id));

describe("data reset:目前 registry 受管的定義整組保留,其餘清掉", () => {
  let databaseUri: string;
  let before: Awaited<ReturnType<typeof definitionStateOf>>;
  let changelog: Document[];
  let runsBefore: Document[];
  let seedPermissionCount: number;
  let result: Awaited<ReturnType<typeof runReset>>;

  beforeAll(async () => {
    databaseUri = mongo.uri("retain");
    await installV1(databaseUri);
    await installV2(databaseUri);
    await insertFieldData(databaseUri);
    before = await definitionStateOf(databaseUri);
    changelog = await changelogOf(databaseUri);
    runsBefore = await journalOf(databaseUri, "run");
    const seedPermissions = await documentsOf(databaseUri, "permissions", {
      source: { $ne: "dynamic" },
    });
    seedPermissionCount = seedPermissions.length;

    result = await runReset(databaseUri, {
      mode: "data",
      args: [MANAGED_V2],
    });
  }, 600_000);

  it("前提:一般部署把定義移出 registry 只是停止同步,不會自動刪除", () => {
    // 第二版的 update 已不登記 reset_leaving,它與它的版本、安裝紀錄、權限在 reset 之前都還在
    expect(before.forms.map((form) => form.key as string)).toContain(LEAVING);
    expect(
      before.forms.find((form) => form.key === LEAVING)?.currentVersion,
    ).toBe(1);
    expect(installationLabels(before.installations)).toContain(
      `${LEAVING}@r1→1`,
    );
    expect(
      before.dynamicPermissions.map((permission) => permission.key as string),
    ).toContain(LEAVING_PERMISSION);
  });

  it("reset 成功,刪留計畫列出每一份保留的受管定義", () => {
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      `保留受管定義 form-definition:${ORDER}(版本 1、2;安裝紀錄 2 筆;動態權限 3 筆)`,
    );
    expect(result.stdout).toContain(
      `保留受管定義 form-definition:${ARCHIVED}(版本 1;安裝紀錄 1 筆;動態權限 0 筆)`,
    );
    expect(result.stdout).toContain(
      `保留受管定義 workflow-definition:${REVIEW}(版本 1;安裝紀錄 1 筆;動態權限 0 筆)`,
    );
    expect(result.stdout).not.toContain(
      `保留受管定義 form-definition:${LEAVING}`,
    );
    // 保留下來的就是目標內容:不增版、不重新發布
    expect(result.stdout).toContain(
      `定義 form-definition:${ORDER}@r2 → 版本 2(unchanged)`,
    );
    expect(result.stdout).toContain(
      `定義 workflow-definition:${REVIEW}@r1 → 版本 1(unchanged)`,
    );
    expect(result.stdout).toContain(
      `定義 form-definition:${ARCHIVED}@r1 → 版本 1(unchanged)`,
    );
  });

  it("受管的共用定義:身分、已發布與已退役的歷史版本原封不動(同一批 _id、同樣的內容)", async () => {
    const after = await definitionStateOf(databaseUri);
    const keptForms = before.forms.filter((form) =>
      [ORDER, ARCHIVED].includes(form.key as string),
    );
    expect(after.forms).toEqual(keptForms);
    expect(
      after.forms.map((form) => form.currentVersion as number | null),
    ).toEqual([null, 2]);
    const keptVersions = before.formVersions.filter(
      (version) =>
        [ORDER, ARCHIVED].includes(version.formKey as string) &&
        version.status !== "draft",
    );
    expect(after.formVersions).toEqual(keptVersions);
    expect(versionLabels(after.formVersions, "formKey")).toEqual([
      `${ARCHIVED}@1:retired`,
      `${ORDER}@1:retired`,
      `${ORDER}@2:published`,
    ]);
    expect(after.workflows).toEqual(
      before.workflows.filter((workflow) => workflow.key === REVIEW),
    );
    expect(versionLabels(after.workflowVersions, "workflowKey")).toEqual([
      `${REVIEW}@1:published`,
    ]);
    expect(after.workflowVersions).toEqual(
      before.workflowVersions.filter(
        (version) =>
          version.workflowKey === REVIEW && version.status === "published",
      ),
    );
  });

  it("動態權限:保留版本用到的權限 id 與退役狀態都不變;退出管理與自建表單的權限清掉", async () => {
    const after = await definitionStateOf(databaseUri);
    const kept = before.dynamicPermissions.filter((permission) =>
      ORDER_PERMISSIONS.includes(permission.key as string),
    );
    expect(kept).toHaveLength(3);
    expect(after.dynamicPermissions).toEqual(kept);
    const retiredAt = Object.fromEntries(
      after.dynamicPermissions.map((permission) => [
        permission.key as string,
        permission.retiredAt === null ? "live" : "retired",
      ]),
    );
    expect(retiredAt).toEqual({
      "project-form.edit-reset_order-amount": "live",
      "project-form.show-reset_order-amount": "live",
      "project-form.show-reset_order-note": "retired",
    });
    // seed 宣告的權限一筆不少
    const seedPermissions = await documentsOf(databaseUri, "permissions", {
      source: { $ne: "dynamic" },
    });
    expect(seedPermissions).toHaveLength(seedPermissionCount);

    // 種子角色對受管欄位級權限的授權還接得上(同一個權限 id);指向被刪角色 / 權限的關聯都不在
    const orderShow = kept.find(
      (permission) => permission.key === "project-form.show-reset_order-amount",
    );
    const grants = await documentsOf(databaseUri, "core_relationships", {
      type: "role_permission",
      secondId: orderShow?._id as ObjectId,
    });
    expect(grants).toHaveLength(1);
    const removed = before.dynamicPermissions.filter(
      (permission) => !ORDER_PERMISSIONS.includes(permission.key as string),
    );
    expect(removed).toHaveLength(2);
    expect(
      await documentsOf(databaseUri, "core_relationships", {
        secondId: {
          $in: removed.map((permission) => permission._id as ObjectId),
        },
      }),
    ).toEqual([]);
  });

  it("安裝紀錄:對得上保留版本的映射原樣保留(含歷史 revision);退出管理的清掉", async () => {
    const after = await definitionStateOf(databaseUri);
    expect(installationLabels(after.installations)).toEqual([
      `${ARCHIVED}@r1→1`,
      `${ORDER}@r1→1`,
      `${ORDER}@r2→2`,
      `${REVIEW}@r1→1`,
    ]);
    expect(after.installations).toEqual(
      before.installations.filter((item) => item.key !== LEAVING),
    );
  });

  it("草稿、畫面自建、租戶客製、退出管理的定義,以及分派、案件、租戶都清掉;root 現值保留", async () => {
    const after = await definitionStateOf(databaseUri);
    // 留下的身分只有三個受管的(前面已逐一對過),草稿一筆不剩
    expect(idsOf(after.forms)).toHaveLength(2);
    expect(idsOf(after.workflows)).toHaveLength(1);
    expect(
      [...after.formVersions, ...after.workflowVersions].filter(
        (version) => version.status === "draft",
      ),
    ).toEqual([]);
    for (const collection of [
      "business_relationships",
      "form_submissions",
      "workflow_instances",
      "workflow_tasks",
    ]) {
      expect(await documentsOf(databaseUri, collection)).toEqual([]);
    }
    const orgs = await documentsOf(databaseUri, "orgs");
    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toMatchObject({ key: "root", name: "現場改過的營運中心" });
    expect(
      await documentsOf(databaseUri, "roles", { isSystem: { $ne: true } }),
    ).toEqual([]);
  });

  it("changelog 與所有執行紀錄保留,另新增這次的 reset;鎖已釋放;之後的 update 完全冪等", async () => {
    expect(await changelogOf(databaseUri)).toEqual(changelog);
    expect(changelog.map((entry) => entry.fileName as string)).toEqual([
      RESET_MARKER,
    ]);
    const runs = await journalOf(databaseUri, "run");
    expect(runs.slice(0, runsBefore.length)).toEqual(runsBefore);
    expect(runs).toHaveLength(runsBefore.length + 1);
    expect(runs.at(-1)).toMatchObject({
      operation: "reset-data",
      status: "succeeded",
      stage: "done",
    });
    expect(await lockOf(databaseUri)).toBeNull();

    const versions = await documentsOf(databaseUri, "form_versions");
    const rerun = await runUpdate(databaseUri, [MANAGED_V2]);
    expect(rerun.stderr).toBe("");
    expect(rerun.status).toBe(0);
    expect(rerun.stdout).toMatch(
      /seed 完成:新增 0 \/ 更新 0 \/ 認養 0 \/ 未變 [1-9]\d*/,
    );
    expect(await documentsOf(databaseUri, "form_versions")).toEqual(versions);
  }, 300_000);
});

describe("data reset:保留歷史之後補齊目前的目標", () => {
  it("資料庫停在第一版、以第二版的來源 reset:第一版原封保留,第二版以新的本地版號發布,退出登記的那張清掉", async () => {
    const databaseUri = mongo.uri("catch-up");
    await installV1(databaseUri);
    const before = await definitionStateOf(databaseUri);
    const notePermission = before.dynamicPermissions.find(
      (permission) => permission.key === "project-form.show-reset_order-note",
    );
    expect(notePermission?.retiredAt).toBeNull();

    const result = await runReset(databaseUri, {
      mode: "data",
      args: [MANAGED_V2],
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      `定義 form-definition:${ORDER}@r2 → 版本 2(updated)`,
    );

    const after = await definitionStateOf(databaseUri);
    const orderBefore = before.forms.find((form) => form.key === ORDER);
    const order = after.forms.find((form) => form.key === ORDER);
    expect(String(order?._id)).toBe(String(orderBefore?._id));
    expect(order?.currentVersion).toBe(2);
    expect(versionLabels(after.formVersions, "formKey")).toEqual([
      `${ARCHIVED}@1:retired`,
      `${ORDER}@1:retired`,
      `${ORDER}@2:published`,
    ]);
    // 第一版仍是同一筆文件;備註的權限沿用同一個 id,這次發布把它標成退役
    const v1Before = before.formVersions.find(
      (version) => version.formKey === ORDER && version.version === 1,
    );
    const v1 = after.formVersions.find(
      (version) => version.formKey === ORDER && version.version === 1,
    );
    expect(String(v1?._id)).toBe(String(v1Before?._id));
    const note = after.dynamicPermissions.find(
      (permission) => permission.key === "project-form.show-reset_order-note",
    );
    expect(String(note?._id)).toBe(String(notePermission?._id));
    expect(note?.retiredAt).toBeInstanceOf(Date);
    expect(installationLabels(after.installations)).toEqual([
      `${ARCHIVED}@r1→1`,
      `${ORDER}@r1→1`,
      `${ORDER}@r2→2`,
      `${REVIEW}@r1→1`,
    ]);
    expect(after.forms.map((form) => form.key as string)).not.toContain(
      LEAVING,
    );
  }, 600_000);
});

/** 被拒絕之後:應用資料原封不動、只多一筆停在預檢的失敗紀錄、鎖已釋放。 */
async function expectRefused(
  databaseUri: string,
  snapshot: Awaited<ReturnType<typeof dumpApplicationData>>,
  reason: string,
  source = MANAGED_V2,
): Promise<void> {
  const refused = await runReset(databaseUri, {
    mode: "data",
    args: [source],
  });
  expect(refused.status).toBe(1);
  expect(refused.stderr).toContain("data reset 預檢未通過(尚未刪除任何資料)");
  expect(refused.stderr).toContain(reason);
  expect(await dumpApplicationData(databaseUri)).toEqual(snapshot);
  const runs = await journalOf(databaseUri, "run");
  expect(runs.at(-1)).toMatchObject({
    operation: "reset-data",
    status: "failed",
    stage: "precheck",
  });
  expect(await lockOf(databaseUri)).toBeNull();
}

describe("data reset:有做到一半的 update 就整次拒絕,一筆都不刪", () => {
  it("依賴快照的 migration 停在 preparing(依賴尚未安裝):拒絕;接續完成後 reset 保留整段歷史 revision 的映射", async () => {
    const databaseUri = mongo.uri("unfinished-preparing");
    const installed = await runUpdate(databaseUri, [V1]);
    expect(installed.status).toBe(0);
    await insertV1Data(databaseUri);
    const interrupted = await runUpdateWithFault(
      databaseUri,
      [V3],
      `migration-preparing@${TICKET_V2}`,
    );
    expect(interrupted.status).toBe(1);
    const snapshot = await dumpApplicationData(databaseUri);

    await expectRefused(
      databaseUri,
      snapshot,
      `migration ${TICKET_V2} 未完成(preparing)`,
      V3,
    );

    const resumed = await runUpdate(databaseUri, [V3]);
    expect(resumed.stderr).toBe("");
    expect(resumed.status).toBe(0);
    const before = await definitionStateOf(databaseUri);
    const result = await runReset(databaseUri, { mode: "data", args: [V3] });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    // 目前只登記第三版,但第一、二版是它的已退役歷史:三個版本與三筆安裝映射都原樣保留
    const after = await definitionStateOf(databaseUri);
    expect(versionLabels(after.formVersions, "formKey")).toEqual([
      `${TICKET}@1:retired`,
      `${TICKET}@2:retired`,
      `${TICKET}@3:published`,
    ]);
    expect(after.formVersions).toEqual(
      before.formVersions.filter((version) => version.formKey === TICKET),
    );
    expect(installationLabels(after.installations)).toEqual([
      `${TICKET}@r1→1`,
      `${TICKET}@r2→2`,
      `${TICKET}@r3→3`,
    ]);
    // 已不登記的舊版登記表與全部案件都清掉
    expect(after.forms.map((form) => form.key as string)).toEqual([TICKET]);
    expect(await documentsOf(databaseUri, "form_submissions")).toEqual([]);
    expect(await documentsOf(databaseUri, "workflow_instances")).toEqual([]);
  }, 600_000);

  it("migration 停在 started(真的在 up 之前中斷):拒絕;update 接續完成後才可以 reset", async () => {
    const databaseUri = mongo.uri("unfinished-started");
    const interrupted = await runUpdateWithFault(
      databaseUri,
      [MANAGED_V2],
      `migration-started@${RESET_MARKER}`,
    );
    expect(interrupted.status).toBe(1);
    const snapshot = await dumpApplicationData(databaseUri);

    await expectRefused(
      databaseUri,
      snapshot,
      `migration ${RESET_MARKER} 未完成(started)`,
    );
    // 被拒絕的那一次沒有替它把 migration 做完
    expect(await changelogOf(databaseUri)).toEqual([]);

    await installV2(databaseUri);
    const result = await runReset(databaseUri, {
      mode: "data",
      args: [MANAGED_V2],
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  }, 600_000);

  it("migration 都記完、但那次 update 停在普通種子之後(定義還沒發布):拒絕;接續完成後才可以 reset", async () => {
    const databaseUri = mongo.uri("unfinished-seeds");
    await installV1(databaseUri);
    const interrupted = await runUpdateWithFault(
      databaseUri,
      [MANAGED_V2],
      "seeds-applied",
    );
    expect(interrupted.status).toBe(1);
    const snapshot = await dumpApplicationData(databaseUri);

    await expectRefused(databaseUri, snapshot, "停在 seeds 階段");
    // 沒有偷偷把第二版發布掉
    expect(
      await documentsOf(databaseUri, "forms", { key: ORDER }),
    ).toMatchObject([{ currentVersion: 1 }]);

    await installV2(databaseUri);
    const result = await runReset(databaseUri, {
      mode: "data",
      args: [MANAGED_V2],
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(
      await documentsOf(databaseUri, "forms", { key: ORDER }),
    ).toMatchObject([{ currentVersion: 2 }]);
  }, 600_000);

  it("migration 的還原(down)做到一半:拒絕;down 接續完成、update 重新套用後才可以 reset", async () => {
    const databaseUri = mongo.uri("unfinished-rollback");
    await installV2(databaseUri);
    const interrupted = await runUpdateWithFault(
      databaseUri,
      [MANAGED_V2, "--down"],
      `rollback-started@${RESET_MARKER}`,
    );
    expect(interrupted.status).toBe(1);
    const snapshot = await dumpApplicationData(databaseUri);

    await expectRefused(
      databaseUri,
      snapshot,
      `migration ${RESET_MARKER} 的還原(down)尚未完成`,
    );

    const down = await runUpdate(databaseUri, [MANAGED_V2, "--down"]);
    expect(down.stderr).toBe("");
    expect(down.status).toBe(0);
    await installV2(databaseUri);
    const result = await runReset(databaseUri, {
      mode: "data",
      args: [MANAGED_V2],
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  }, 600_000);
});
