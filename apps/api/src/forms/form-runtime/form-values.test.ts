import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { Connection, Types } from "mongoose";

import {
  type AuthTestApp,
  startAuthTestApp,
} from "../../auth/test-support/auth-app";
import { createOrg, createUser } from "../../auth/test-support/fixtures";
import { HOOK_TIMEOUT_MS } from "../../database/test-support/mongo-connection";
import {
  CREATE_DRAFT,
  CREATE_FORM,
  FORM_LOOKUP,
  FORM_LOOKUP_RECORD,
  type FormOperator,
  M,
  MODULE_KEY,
  PASSWORD,
  PREVIEW_VERSION,
  SUBMIT,
  type SubmissionRow,
  assignForm,
  call,
  codeOf,
  createDraft,
  createOperator,
  createSubmitted,
  definitionOf,
  extensionsOf,
  field,
  getSubmission,
  ok,
  publishDefinition,
  publishNewForm,
  rootToken,
  saveDefinition,
  showKey,
} from "../test-support/form-fixtures";

interface LookupRow {
  id: string;
  value: string | null;
  label: string | null;
  values: Record<string, unknown>;
}

/**
 * 值的語意(Spec 6a §5「值的存法」「表達式看到的是語意值」「顯示名怎麼決定」「lookup 來源」、§10「值」):
 * 真 GraphQL + 真 MongoDB(TEST-07)。
 */
describe("表單的值:語意值、引用快照、現名 / 快照、lookup 以定義為準", () => {
  let api: AuthTestApp;
  let connection: Connection;
  let root: string;
  let tenant: Types.ObjectId;
  let otherTenant: Types.ObjectId;
  let staff: FormOperator;
  let colleague: Types.ObjectId;
  let outsider: Types.ObjectId;

  beforeAll(async () => {
    api = await startAuthTestApp("cookhome-test-form-values");
    connection = api.connection;
    root = await rootToken(api);
    tenant = await createOrg(connection, { name: "值的租戶" });
    otherTenant = await createOrg(connection, { name: "別的租戶" });
    staff = await createOperator(api, connection, {
      orgId: tenant,
      permissionKeys: [M.view, M.create, M.edit],
    });
    colleague = await createUser(connection, {
      account: "colleague",
      password: PASSWORD,
      orgIds: [tenant],
    });
    outsider = await createUser(connection, {
      account: "outsider",
      password: PASSWORD,
      orgIds: [otherTenant],
    });
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await api.close();
  }, HOOK_TIMEOUT_MS);

  it('表達式拿到語意值:類別選項存 { value, label },條件 `kind == "drink"` 照樣成立;選項 label 送出時重取', async () => {
    await publishNewForm(
      api,
      root,
      "semantic",
      definitionOf([
        field("title", "text"),
        field("kind", "select", {
          options: { kind: "fieldCategory", key: "demo-category" },
        }),
        field("drink_note", "text", {
          visibleWhen: { "==": [{ var: "kind" }, "drink"] },
        }),
        field("kind_label", "text", {
          valueSource: {
            kind: "computed",
            expr: { concat: ["類別:", { optionLabel: "kind" }] },
          },
        }),
      ]),
    );
    await assignForm(api, root, "semantic", [tenant]);
    const submitted = await createSubmitted(api, staff.token, "semantic", {
      title: "飲料",
      kind: { value: "drink", label: "前端亂給的 label" },
      drink_note: "要冰的",
    });
    expect(submitted.values.kind).toEqual({ value: "drink", label: "飲品" });
    expect(submitted.values.drink_note).toBe("要冰的");
    expect(submitted.values.kind_label).toBe("類別:飲品");
    expect(
      submitted.fieldStates.find((state) => state.key === "drink_note")
        ?.visible,
    ).toBe(true);
    // 不在類別裡的值 → 擋下
    const draft = await createDraft(api, staff.token, "semantic", {
      title: "亂選",
      kind: "not-a-category-value",
    });
    const invalid = await call(api, staff.token, SUBMIT, {
      input: { id: draft.id, expectedEditVersion: draft.editVersion },
    });
    expect(extensionsOf(invalid).fieldErrors).toContainEqual(
      expect.objectContaining({ fieldKey: "kind", code: "OPTION_INVALID" }),
    );
  });

  describe("引用(reference)", () => {
    let submitted: SubmissionRow;

    beforeAll(async () => {
      await publishNewForm(
        api,
        root,
        "ref_form",
        definitionOf([
          field("title", "text"),
          field("owner", "reference", {
            source: { provider: "user", labelField: "name" },
          }),
        ]),
      );
      await assignForm(api, root, "ref_form", [tenant]);
      submitted = await createSubmitted(api, staff.token, "ref_form", {
        title: "找同事",
        owner: { id: String(colleague), label: "前端給的名字" },
      });
    }, HOOK_TIMEOUT_MS);

    it("送出時重驗來源可讀並重取 label 寫快照", async () => {
      expect(submitted.values.owner).toEqual({
        id: String(colleague),
        label: "colleague",
      });
      const draft = await createDraft(api, staff.token, "ref_form", {
        title: "引用別租戶的人",
        owner: String(outsider),
      });
      const result = await call(api, staff.token, SUBMIT, {
        input: { id: draft.id, expectedEditVersion: draft.editVersion },
      });
      expect(codeOf(result)).toBe("VALIDATION_FAILED");
      expect(extensionsOf(result).fieldErrors).toContainEqual(
        expect.objectContaining({
          fieldKey: "owner",
          code: "SOURCE_UNAVAILABLE",
        }),
      );
    });

    it("顯示名:來源還在 → 現名;來源已刪 → 快照 + available false;存的快照不變", async () => {
      await connection
        .collection("users")
        .updateOne({ _id: colleague }, { $set: { name: "改名後的同事" } });
      const renamed = await getSubmission(api, staff.token, submitted.id);
      expect(renamed.displayValues).toEqual([
        {
          fieldKey: "owner",
          items: [
            {
              value: String(colleague),
              label: "改名後的同事",
              available: true,
            },
          ],
        },
      ]);
      expect(renamed.values.owner).toEqual({
        id: String(colleague),
        label: "colleague",
      });
      await connection
        .collection("users")
        .updateOne({ _id: colleague }, { $set: { deletedAt: new Date() } });
      const gone = await getSubmission(api, staff.token, submitted.id);
      expect(gone.displayValues[0]?.items).toEqual([
        { value: String(colleague), label: "colleague", available: false },
      ]);
      await connection
        .collection("users")
        .updateOne({ _id: colleague }, { $set: { deletedAt: null } });
    });
  });

  it("lookup 的 provider / filter 只認版本定義:前端只帶目標與關鍵字,帶不了 provider;定義的 filter 後端套", async () => {
    const disabledOrg = await createOrg(connection, {
      name: "值的租戶-停用部門",
      parentId: tenant,
    });
    await connection
      .collection("orgs")
      .updateOne({ _id: disabledOrg }, { $set: { enabled: false } });
    await createOrg(connection, {
      name: "值的租戶-啟用部門",
      parentId: tenant,
    });
    await publishNewForm(
      api,
      root,
      "lookup_form",
      definitionOf([
        field("title", "text"),
        field("dept", "select", {
          widget: { kind: "autocomplete" },
          options: {
            kind: "lookup",
            source: {
              provider: "org",
              labelField: "name",
              filter: { enabled: true },
            },
          },
        }),
      ]),
    );
    await assignForm(api, root, "lookup_form", [tenant]);
    // 租戶開「使用者可見下層組織資料」:員工的可見範圍才含兩個部門
    await connection
      .collection("orgs")
      .updateOne(
        { _id: tenant },
        { $set: { "settings.visibility": "subtree" } },
      );
    const found = await ok<{ formLookup: { items: LookupRow[] } }>(
      api,
      staff.token,
      FORM_LOOKUP,
      {
        input: {
          formKey: "lookup_form",
          version: 1,
          target: { fieldKey: "dept" },
          keyword: "值的租戶-",
        },
      },
    );
    expect(found.formLookup.items.map((item) => item.label)).toEqual([
      "值的租戶-啟用部門",
    ]);
    // 可見範圍外(別的租戶)查不到
    const outside = await ok<{ formLookup: { items: LookupRow[] } }>(
      api,
      staff.token,
      FORM_LOOKUP,
      {
        input: {
          formKey: "lookup_form",
          version: 1,
          target: { fieldKey: "dept" },
          keyword: "別的租戶",
        },
      },
    );
    expect(outside.formLookup.items).toEqual([]);
    // input 上沒有 provider / filter 這種欄位:硬塞就被 schema 擋下
    const forged = await call(api, staff.token, FORM_LOOKUP, {
      input: {
        formKey: "lookup_form",
        version: 1,
        target: { fieldKey: "dept" },
        provider: "user",
      },
    });
    expect(forged.errors).toBeDefined();
    // 沒有 lookup 來源的欄位不能當目標
    const notLookup = await call(api, staff.token, FORM_LOOKUP, {
      input: {
        formKey: "lookup_form",
        version: 1,
        target: { fieldKey: "title" },
      },
    });
    expect(extensionsOf(notLookup).fields).toEqual(["target"]);
  });

  it("`form_submission` 來源依每筆自己的版本判斷欄位:受保護無權省略、舊版本沒有的回 null", async () => {
    // 來源表單 v1:title / note 都公開
    await publishNewForm(
      api,
      root,
      "src_form",
      definitionOf([field("title", "text"), field("note", "text")]),
    );
    await assignForm(api, root, "src_form", [tenant]);
    const onV1 = await createSubmitted(api, staff.token, "src_form", {
      title: "舊版的單",
      note: "v1 的備註",
    });
    // 目標表單在 v1 時設計:帶入 note / title
    await ok(api, root, CREATE_FORM, {
      input: { key: "dst_form", moduleKey: MODULE_KEY, name: "帶入目標" },
    });
    const dstDraft = await ok<{
      createFormVersionDraft: { formVersion: { draftRevision: number } };
    }>(api, root, CREATE_DRAFT, { input: { formKey: "dst_form" } });
    const prefillSource = {
      provider: "form_submission",
      formKey: "src_form",
      labelField: "title",
    };
    const dstV1 = definitionOf(
      [field("t", "text"), field("n", "text"), field("e", "text")],
      {
        prefills: [
          {
            label: "從來源帶入",
            source: prefillSource,
            mapping: [
              { sourceField: "title", fieldKey: "t" },
              { sourceField: "note", fieldKey: "n" },
            ],
          },
        ],
      },
    );
    await saveDefinition(
      api,
      root,
      "dst_form",
      dstV1,
      dstDraft.createFormVersionDraft.formVersion.draftRevision,
    );
    await ok(
      api,
      root,
      "mutation P($input: PublishFormVersionInput!) { publishFormVersion(input: $input) { formVersion { version } } }",
      {
        input: {
          formKey: "dst_form",
          expectedDraftRevision: 1,
          changelog: "v1",
        },
      },
    );
    await assignForm(api, root, "dst_form", [tenant]);

    // 來源表單 v2:note 改成受保護,另加 extra
    await publishDefinition(
      api,
      root,
      "src_form",
      definitionOf([
        field("title", "text"),
        field("note", "text", { permission: { show: true, edit: false } }),
        field("extra", "text"),
      ]),
      1,
    );
    const writer = await createOperator(api, connection, {
      orgId: tenant,
      permissionKeys: [M.view, M.create, showKey("src_form", "note")],
    });
    const onV2 = await createSubmitted(api, writer.token, "src_form", {
      title: "新版的單",
      note: "v2 的機密備註",
      extra: "v2 才有",
    });

    const lookupDst = async (
      version: number,
    ): Promise<Map<string, LookupRow>> => {
      const data = await ok<{ formLookup: { items: LookupRow[] } }>(
        api,
        staff.token,
        FORM_LOOKUP,
        {
          input: {
            formKey: "dst_form",
            version,
            target: { prefillIndex: 0 },
          },
        },
      );
      return new Map(data.formLookup.items.map((item) => [item.id, item]));
    };
    const v1Rows = await lookupDst(1);
    expect(v1Rows.get(onV1.id)).toMatchObject({
      label: "舊版的單",
      values: { title: "舊版的單", note: "v1 的備註" },
    });
    // v2 的那筆:note 受保護且 staff 沒有 show → 省略(不是 null)
    expect(v1Rows.get(onV2.id)?.values).toEqual({ title: "新版的單" });

    // 目標表單改版:加帶入 extra(v2 才有的欄位)
    await publishDefinition(
      api,
      root,
      "dst_form",
      definitionOf(
        [field("t", "text"), field("n", "text"), field("e", "text")],
        {
          prefills: [
            {
              label: "從來源帶入",
              source: prefillSource,
              mapping: [
                { sourceField: "title", fieldKey: "t" },
                { sourceField: "extra", fieldKey: "e" },
              ],
            },
          ],
        },
      ),
      1,
    );
    const v2Rows = await lookupDst(2);
    expect(v2Rows.get(onV1.id)?.values).toEqual({
      title: "舊版的單",
      extra: null,
    });
    expect(v2Rows.get(onV2.id)?.values).toEqual({
      title: "新版的單",
      extra: "v2 才有",
    });
    const single = await ok<{ formLookupRecord: { record: LookupRow | null } }>(
      api,
      staff.token,
      FORM_LOOKUP_RECORD,
      {
        input: {
          formKey: "dst_form",
          version: 2,
          target: { prefillIndex: 0 },
          id: onV2.id,
        },
      },
    );
    expect(single.formLookupRecord.record?.values).toMatchObject({
      extra: "v2 才有",
    });
  });

  it("設計器預覽:對草稿跑計算與條件,不建提交", async () => {
    await ok(api, root, CREATE_FORM, {
      input: { key: "preview_form", moduleKey: MODULE_KEY, name: "預覽" },
    });
    await ok(api, root, CREATE_DRAFT, { input: { formKey: "preview_form" } });
    await saveDefinition(
      api,
      root,
      "preview_form",
      definitionOf([
        field("title", "text", { rules: { required: true } }),
        field("qty", "number"),
        field("double", "number", {
          valueSource: { kind: "computed", expr: { "*": [{ var: "qty" }, 2] } },
        }),
        field("big_note", "text", {
          visibleWhen: { ">": [{ var: "qty" }, 10] },
        }),
      ]),
      0,
    );
    const before = await connection
      .collection("form_submissions")
      .countDocuments();
    const preview = await ok<{
      previewFormVersion: {
        values: Record<string, unknown>;
        fieldStates: { key: string; visible: boolean }[];
        fieldErrors: { fieldKey: string; code: string }[];
      };
    }>(api, root, PREVIEW_VERSION, {
      input: { formKey: "preview_form", values: { qty: 3, big_note: "x" } },
    });
    expect(preview.previewFormVersion.values).toMatchObject({
      double: "6",
      big_note: null,
    });
    expect(
      preview.previewFormVersion.fieldStates.find(
        (state) => state.key === "big_note",
      )?.visible,
    ).toBe(false);
    expect(preview.previewFormVersion.fieldErrors).toEqual([
      expect.objectContaining({ fieldKey: "title", code: "REQUIRED" }),
    ]);
    expect(
      await connection.collection("form_submissions").countDocuments(),
    ).toBe(before);
  });
});
