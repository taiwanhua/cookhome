import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { Connection, Types } from "mongoose";

import {
  type AuthTestApp,
  startAuthTestApp,
} from "../../auth/test-support/auth-app";
import { createOrg } from "../../auth/test-support/fixtures";
import { HOOK_TIMEOUT_MS } from "../../database/test-support/mongo-connection";
import {
  CREATE_DRAFT,
  CREATE_FORM,
  F,
  FORK_FORM,
  FORM,
  FORMS,
  FORMS_MODULES,
  FORM_SUBMISSION,
  FORM_VERSION,
  type FormOperator,
  type FormRow,
  M,
  MODULE_FORMS,
  MODULE_KEY,
  REVOKE,
  SET_TENANT_ENABLED,
  UPDATE_FORM,
  type VersionRow,
  assignForm,
  call,
  codeOf,
  createOperator,
  createSubmitted,
  definitionOf,
  extensionsOf,
  field,
  getForm,
  ok,
  publishDraft,
  publishNewForm,
  rootToken,
} from "../test-support/form-fixtures";

/**
 * 表單的可見、分派、啟用、客製副本(Spec 6a §3、§10「表單」):真 GraphQL + 真 MongoDB(TEST-07)。
 */
describe("表單:副本、分派 / 啟用 / 收回的交集、租戶邊界", () => {
  let api: AuthTestApp;
  let connection: Connection;
  let root: string;
  let tenantA: Types.ObjectId;
  let tenantB: Types.ObjectId;
  let adminA: FormOperator;
  let adminB: FormOperator;
  let staffA: FormOperator;
  let staffB: FormOperator;
  /** A 底下的部門使用者:可見範圍不含租戶頂層。 */
  let deptStaffA: FormOperator;

  const simple = definitionOf([field("title", "text"), field("qty", "number")]);

  async function moduleFormKeys(token: string): Promise<string[]> {
    const data = await ok<{ moduleForms: { key: string }[] }>(
      api,
      token,
      MODULE_FORMS,
      { moduleKey: MODULE_KEY },
    );
    return data.moduleForms
      .map((form) => form.key)
      .toSorted((a, b) => a.localeCompare(b));
  }

  async function listedKeys(token: string): Promise<string[]> {
    const data = await ok<{ forms: { items: FormRow[] } }>(api, token, FORMS, {
      input: { moduleKey: MODULE_KEY, pageSize: 100 },
    });
    return data.forms.items
      .map((form) => form.key)
      .toSorted((a, b) => a.localeCompare(b));
  }

  beforeAll(async () => {
    api = await startAuthTestApp("cookhome-test-forms");
    connection = api.connection;
    root = await rootToken(api);
    tenantA = await createOrg(connection, { name: "租戶甲" });
    tenantB = await createOrg(connection, { name: "租戶乙" });
    const deptA = await createOrg(connection, {
      name: "甲的部門",
      parentId: tenantA,
    });
    const adminKeys = [F.all, M.all];
    adminA = await createOperator(api, connection, {
      orgId: tenantA,
      permissionKeys: adminKeys,
      moduleKeys: [...FORMS_MODULES, MODULE_KEY],
    });
    adminB = await createOperator(api, connection, {
      orgId: tenantB,
      permissionKeys: adminKeys,
      moduleKeys: [...FORMS_MODULES, MODULE_KEY],
    });
    const staffKeys = [M.view, M.create];
    staffA = await createOperator(api, connection, {
      orgId: tenantA,
      permissionKeys: staffKeys,
    });
    staffB = await createOperator(api, connection, {
      orgId: tenantB,
      permissionKeys: staffKeys,
    });
    deptStaffA = await createOperator(api, connection, {
      orgId: deptA,
      ownerOrgId: tenantA,
      permissionKeys: staffKeys,
    });

    await publishNewForm(api, root, "shared_a", simple, "共用甲");
    await publishNewForm(api, root, "shared_b", simple, "共用乙");
    await assignForm(api, root, "shared_a", [tenantA]);
    await assignForm(api, root, "shared_b", [tenantB]);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await api.close();
  }, HOOK_TIMEOUT_MS);

  it("分派的交集:A 只看得到分派給 A 的、B 只看得到 B 的;root 看全部共用表單", async () => {
    expect(await moduleFormKeys(staffA.token)).toEqual(["shared_a"]);
    expect(await moduleFormKeys(staffB.token)).toEqual(["shared_b"]);
    expect(await moduleFormKeys(root)).toEqual(
      expect.arrayContaining(["shared_a", "shared_b"]),
    );
    // 設計端清單同一條判準;root 視角附分派清單
    expect(await listedKeys(adminA.token)).toEqual(["shared_a"]);
    const shared = await getForm(api, root, "shared_a");
    expect(shared.assignments).toEqual([
      { tenantOrgId: String(tenantA), enabled: true },
    ]);
  });

  it("部門使用者(可見範圍不含租戶頂層)也查得到本租戶的 org_form", async () => {
    expect(await moduleFormKeys(deptStaffA.token)).toEqual(["shared_a"]);
  });

  it("跨租戶查不到:別租戶的表單讀不到(NOT_FOUND)、不能以它為基底", async () => {
    const read = await call(api, adminA.token, FORM, { key: "shared_b" });
    expect(codeOf(read)).toBe("NOT_FOUND");
    const fork = await call(api, adminA.token, FORK_FORM, {
      input: {
        sourceKey: "shared_b",
        sourceVersion: 1,
        key: "stolen",
        name: "偷來的",
      },
    });
    expect(codeOf(fork)).toBe("NOT_FOUND");
    const create = await call(api, staffA.token, CREATE_FORM, {
      input: { key: "nope", moduleKey: MODULE_KEY, name: "x" },
    });
    expect(codeOf(create)).toBe("FORBIDDEN");
  });

  it("租戶不能建共用表單、不能改共用表單、不能分派(站在根組織才行)", async () => {
    const create = await call(api, adminA.token, CREATE_FORM, {
      input: { key: "tenant_made", moduleKey: MODULE_KEY, name: "租戶建的" },
    });
    expect(extensionsOf(create).reason).toBe("ROOT_ONLY");
    const draft = await call(api, adminA.token, CREATE_DRAFT, {
      input: { formKey: "shared_a", baseVersion: 1 },
    });
    expect(extensionsOf(draft).reason).toBe("NOT_FORM_OWNER");
    const assign = await call(api, adminA.token, REVOKE, {
      input: { formKey: "shared_a", tenantOrgId: String(tenantA) },
    });
    expect(extensionsOf(assign).reason).toBe("ROOT_ONLY");
    const sharedForTenant = await getForm(api, adminA.token, "shared_a");
    expect(sharedForTenant.abilities).toEqual({
      canEdit: false,
      canAssign: false,
      canSetEnabled: true,
      canFork: true,
    });
  });

  it("forms.key 建立後不可改;key 格式與撞名擋下", async () => {
    await ok(api, root, CREATE_FORM, {
      input: { key: "immutable_key", moduleKey: MODULE_KEY, name: "原名" },
    });
    const updated = await ok<{ updateForm: { form: FormRow } }>(
      api,
      root,
      UPDATE_FORM,
      { input: { key: "immutable_key", name: "新名" } },
    );
    expect(updated.updateForm.form).toMatchObject({
      key: "immutable_key",
      name: "新名",
    });
    const duplicated = await call(api, root, CREATE_FORM, {
      input: { key: "immutable_key", moduleKey: MODULE_KEY, name: "撞名" },
    });
    expect(codeOf(duplicated)).toBe("VALIDATION_FAILED");
    expect(extensionsOf(duplicated).fields).toEqual(["key"]);
    const badFormat = await call(api, root, CREATE_FORM, {
      input: { key: "Bad-Key", moduleKey: MODULE_KEY, name: "格式錯" },
    });
    expect(extensionsOf(badFormat).fields).toEqual(["key"]);
    const notFormModule = await call(api, root, CREATE_FORM, {
      input: { key: "wrong_module", moduleKey: "demo.sample-two", name: "x" },
    });
    expect(extensionsOf(notFormModule).fields).toEqual(["moduleKey"]);
  });

  it("客製副本:以分派來的共用表單某版為基底 → 同模組、記 forkedFrom、複製定義成草稿、自動建本租戶的 org_form", async () => {
    const forked = await ok<{ forkForm: { form: FormRow } }>(
      api,
      adminA.token,
      FORK_FORM,
      {
        input: {
          sourceKey: "shared_a",
          sourceVersion: 1,
          key: "shared_a_tenant",
          name: "共用甲(甲版)",
        },
      },
    );
    expect(forked.forkForm.form).toMatchObject({
      moduleKey: MODULE_KEY,
      isShared: false,
      ownerOrgId: String(tenantA),
      forkedFrom: { formKey: "shared_a", version: 1 },
      currentVersion: null,
      hasDraft: true,
      tenantEnabled: true,
      abilities: { canEdit: true, canAssign: false },
    });
    const draft = await ok<{ formVersion: { formVersion: VersionRow } }>(
      api,
      adminA.token,
      FORM_VERSION,
      { formKey: "shared_a_tenant" },
    );
    expect(
      draft.formVersion.formVersion.fields.map((item) => item.key),
    ).toEqual(["title", "qty"]);
    // 發布前不可新增;發布後只有 A 看得到
    expect(await moduleFormKeys(staffA.token)).toEqual(["shared_a"]);
    await publishDraft(api, adminA.token, "shared_a_tenant", simple, 0);
    expect(await moduleFormKeys(staffA.token)).toEqual([
      "shared_a",
      "shared_a_tenant",
    ]);
    expect(await moduleFormKeys(staffB.token)).toEqual(["shared_b"]);
    const other = await call(api, adminB.token, FORM, {
      key: "shared_a_tenant",
    });
    expect(codeOf(other)).toBe("NOT_FOUND");
    // root 設計端看得到全部(含客製),但改不動客製表單
    const rootView = await getForm(api, root, "shared_a_tenant");
    expect(rootView.abilities.canEdit).toBe(false);
  });

  it("租戶停用 → 不能新增但設計端仍列出(標停用);收回分派 → 不列、不能新增,歷史提交照常可讀", async () => {
    await publishNewForm(api, root, "shared_toggle", simple, "開關");
    await assignForm(api, root, "shared_toggle", [tenantA]);
    const history = await createSubmitted(api, staffA.token, "shared_toggle", {
      title: "停用前的單",
      qty: "1",
    });

    await ok(api, adminA.token, SET_TENANT_ENABLED, {
      input: { formKey: "shared_toggle", enabled: false },
    });
    expect(await moduleFormKeys(staffA.token)).not.toContain("shared_toggle");
    const listed = await ok<{ forms: { items: FormRow[] } }>(
      api,
      adminA.token,
      FORMS,
      { input: { keyword: "shared_toggle" } },
    );
    expect(listed.forms.items[0]).toMatchObject({
      key: "shared_toggle",
      tenantEnabled: false,
    });

    await ok(api, adminA.token, SET_TENANT_ENABLED, {
      input: { formKey: "shared_toggle", enabled: true },
    });
    expect(await moduleFormKeys(staffA.token)).toContain("shared_toggle");

    await ok(api, root, REVOKE, {
      input: { formKey: "shared_toggle", tenantOrgId: String(tenantA) },
    });
    expect(await moduleFormKeys(staffA.token)).not.toContain("shared_toggle");
    expect(await listedKeys(adminA.token)).not.toContain("shared_toggle");
    const read = await ok<{ formSubmission: { submission: { id: string } } }>(
      api,
      staffA.token,
      FORM_SUBMISSION,
      { id: history.id },
    );
    expect(read.formSubmission.submission.id).toBe(history.id);
  });

  it("以任一版本為基底建新表單:草稿與未發布的版本不能當基底", async () => {
    await publishNewForm(api, root, "base_src", simple);
    const bad = await call(api, root, FORK_FORM, {
      input: {
        sourceKey: "base_src",
        sourceVersion: 9,
        key: "base_copy",
        name: "副本",
      },
    });
    expect(extensionsOf(bad).fields).toEqual(["baseVersion"]);
    // root 以共用表單為基底 → 仍是共用表單(之後再分派)
    const copied = await ok<{ forkForm: { form: FormRow } }>(
      api,
      root,
      FORK_FORM,
      {
        input: {
          sourceKey: "base_src",
          sourceVersion: 1,
          key: "base_copy",
          name: "副本",
        },
      },
    );
    expect(copied.forkForm.form).toMatchObject({
      isShared: true,
      forkedFrom: { formKey: "base_src", version: 1 },
    });
  });
});
