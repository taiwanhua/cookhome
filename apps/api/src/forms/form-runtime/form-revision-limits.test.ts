import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { type Connection, Types, mongo } from "mongoose";

import {
  type AuthTestApp,
  startAuthTestApp,
} from "../../auth/test-support/auth-app";
import { createOrg } from "../../auth/test-support/fixtures";
import { HOOK_TIMEOUT_MS } from "../../database/test-support/mongo-connection";
import {
  FORM_TEST_TIMEOUT_MS,
  type FormOperator,
  M,
  type SubmissionRow,
  UPDATE_SUBMISSION,
  assignForm,
  call,
  codeOf,
  createOperator,
  createSubmitted,
  definitionOf,
  extensionsOf,
  field,
  ok,
  publishNewForm,
  rawSubmission,
  rootToken,
} from "../test-support/form-fixtures";
import { MAX_DOCUMENT_BYTES, MAX_REVISIONS } from "./revision-limits";

jest.setTimeout(FORM_TEST_TIMEOUT_MS);

interface RawRevision {
  revision: number;
  values: Record<string, unknown>;
  ctx: Record<string, unknown>;
}

interface RawSubmission {
  revision: number;
  editVersion: number;
  values: Record<string, unknown>;
  revisions: RawRevision[];
}

/** 已完成修改的 input:只改標題,其餘照目前存的值送回。 */
function updateOf(
  raw: RawSubmission,
  id: string,
  title: string,
): { input: Record<string, unknown> } {
  return {
    input: {
      id,
      expectedEditVersion: raw.editVersion,
      expectedRevision: raw.revision,
      values: { ...raw.values, title },
    },
  };
}

/**
 * `revisions[]` 上限:綁流程的表單每筆提交 ≤ 50 筆修訂(沒綁流程的不限次數)、更新後的完整文件 BSON ≤ 8MB;
 * 超過 → `CONFLICT`(`REVISION_LIMIT` / `DOCUMENT_TOO_LARGE`),什麼都不寫。
 * 前置狀態(已有 49 / 50 筆修訂、已有大快照)直接寫進 Mongo —— 走 GraphQL 改 50 次或送 8MB 的值
 * 只是在測 api 的請求大小,不是這條規則。
 */
describe("提交的修訂上限與文件容量上限", () => {
  let api: AuthTestApp;
  let connection: Connection;
  let staff: FormOperator;

  const FORM = "rev_limit";
  const BOUND_FORM = "rev_limit_bound";
  let tenant: Types.ObjectId;

  /** 本租戶把這張表單綁上流程(直接寫 `org_form_workflow`;流程本身不影響修訂上限的判斷)。 */
  async function bindWorkflow(formKey: string): Promise<void> {
    const form = await connection
      .collection("forms")
      .findOne<{ _id: Types.ObjectId }>({ key: formKey });
    if (!form) {
      throw new Error(`表單 ${formKey} 不存在`);
    }
    await connection.collection("business_relationships").insertOne({
      tenantId: tenant,
      type: "org_form_workflow",
      firstId: tenant,
      secondId: form._id,
      thirdId: new Types.ObjectId(),
      meta: {},
      deletedAt: null,
    });
  }

  /** 把一筆已送出的提交改成「已有 `count` 筆修訂」(每筆是第一筆快照的複本,可附上大字串)。 */
  async function seedRevisions(
    id: string,
    count: number,
    padding = "",
  ): Promise<RawSubmission> {
    const raw = (await rawSubmission(
      connection,
      id,
    )) as unknown as RawSubmission;
    const first = raw.revisions[0];
    if (first === undefined) {
      throw new Error("送出後應有第一筆修訂");
    }
    const revisions = Array.from({ length: count }, (_, index) => ({
      ...first,
      revision: index + 1,
      values: { ...first.values, ...(padding !== "" && { note: padding }) },
    }));
    await connection
      .collection("form_submissions")
      .updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { revisions, revision: count } },
      );
    return (await rawSubmission(connection, id)) as unknown as RawSubmission;
  }

  beforeAll(async () => {
    api = await startAuthTestApp("cookhome-test-form-revision-limits");
    connection = api.connection;
    const root = await rootToken(api);
    tenant = await createOrg(connection, { name: "修訂上限租戶" });
    staff = await createOperator(api, connection, {
      orgId: tenant,
      permissionKeys: [M.view, M.create, M.edit],
    });
    await publishNewForm(
      api,
      root,
      FORM,
      definitionOf([field("title", "text"), field("note", "multiline")]),
    );
    await assignForm(api, root, FORM, [tenant]);
    await publishNewForm(
      api,
      root,
      BOUND_FORM,
      definitionOf([field("title", "text"), field("note", "multiline")]),
    );
    await assignForm(api, root, BOUND_FORM, [tenant]);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await api.close();
  }, HOOK_TIMEOUT_MS);

  it(`沒綁流程的表單不限修訂次數:已有 ${String(MAX_REVISIONS)} 筆修訂時第 ${String(MAX_REVISIONS + 1)} 筆照寫`, async () => {
    const submitted = await createSubmitted(api, staff.token, FORM, {
      title: "第一版",
    });
    const seeded = await seedRevisions(submitted.id, MAX_REVISIONS);

    const next = await ok<{
      updateFormSubmission: { submission: SubmissionRow };
    }>(
      api,
      staff.token,
      UPDATE_SUBMISSION,
      updateOf(seeded, submitted.id, "第五十一版"),
    );

    expect(next.updateFormSubmission.submission.revision).toBe(
      MAX_REVISIONS + 1,
    );
  });

  it(`綁流程的表單:第 ${String(MAX_REVISIONS)} 筆修訂還寫得進去;第 ${String(MAX_REVISIONS + 1)} 筆 → 409 REVISION_LIMIT,不寫入`, async () => {
    // 先送出(那時還沒綁流程 = 不走流程的已完成、可修改),再綁流程
    const submitted = await createSubmitted(api, staff.token, BOUND_FORM, {
      title: "第一版",
    });
    await bindWorkflow(BOUND_FORM);
    const seeded = await seedRevisions(submitted.id, MAX_REVISIONS - 1);

    const last = await ok<{
      updateFormSubmission: { submission: SubmissionRow };
    }>(
      api,
      staff.token,
      UPDATE_SUBMISSION,
      updateOf(seeded, submitted.id, "第五十版"),
    );
    expect(last.updateFormSubmission.submission.revision).toBe(MAX_REVISIONS);

    const full = (await rawSubmission(
      connection,
      submitted.id,
    )) as unknown as RawSubmission;
    const over = await call(
      api,
      staff.token,
      UPDATE_SUBMISSION,
      updateOf(full, submitted.id, "第五十一版"),
    );
    expect(codeOf(over)).toBe("CONFLICT");
    expect(extensionsOf(over).reason).toBe("REVISION_LIMIT");
    const after = (await rawSubmission(
      connection,
      submitted.id,
    )) as unknown as RawSubmission;
    expect(after.revision).toBe(MAX_REVISIONS);
    expect(after.revisions).toHaveLength(MAX_REVISIONS);
    expect(after.values.title).toBe("第五十版");
  });

  it("更新後的完整文件超過 8MB(含這次要加的快照)→ 409 DOCUMENT_TOO_LARGE,不寫入", async () => {
    const submitted = await createSubmitted(api, staff.token, FORM, {
      title: "大文件",
    });
    // 讓文件剛好比上限少 64 bytes(現在寫得下);再加一筆修訂快照(遠大於 64 bytes)就超過
    const probe = await seedRevisions(submitted.id, 1, "x");
    const room =
      MAX_DOCUMENT_BYTES - 64 - mongo.BSON.calculateObjectSize(probe);
    const seeded = await seedRevisions(submitted.id, 1, "x".repeat(room + 1));
    expect(mongo.BSON.calculateObjectSize(seeded)).toBeLessThanOrEqual(
      MAX_DOCUMENT_BYTES,
    );
    const over = await call(
      api,
      staff.token,
      UPDATE_SUBMISSION,
      updateOf(seeded, submitted.id, "改一個字"),
    );
    expect(codeOf(over)).toBe("CONFLICT");
    expect(extensionsOf(over).reason).toBe("DOCUMENT_TOO_LARGE");
    const after = (await rawSubmission(
      connection,
      submitted.id,
    )) as unknown as RawSubmission;
    expect(after.revision).toBe(1);
    expect(after.editVersion).toBe(seeded.editVersion);
  });
});
