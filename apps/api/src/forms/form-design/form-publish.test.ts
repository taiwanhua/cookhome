import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Connection } from "mongoose";

import {
  type AuthTestApp,
  startAuthTestApp,
} from "../../auth/test-support/auth-app";
import { HOOK_TIMEOUT_MS } from "../../database/test-support/mongo-connection";
import {
  CREATE_DRAFT,
  CREATE_FORM,
  CREATE_FORM_DRAFT,
  FORM_VERSION,
  FORM_VERSIONS,
  MODULE_FORMS,
  MODULE_KEY,
  PUBLISH,
  RETIRE_CURRENT,
  RETRY_PUBLISH,
  SAVE_DRAFT,
  type VersionRow,
  call,
  codeOf,
  definitionOf,
  extensionsOf,
  field,
  getForm,
  nextRequestId,
  ok,
  publishDefinition,
  publishNewForm,
  rootToken,
  saveDefinition,
  showKey,
} from "../test-support/form-fixtures";
import { FormPublishHooks, type PublishCheckpoint } from "./form-publish-hooks";

interface PermissionDoc {
  _id: unknown;
  key: string;
  name: string;
  source: string;
  retiredAt: Date | null;
}

/**
 * 四步發布與冪等重試(Spec 6a §6、§10「發布」):打真的 GraphQL 端點、對真 MongoDB(TEST-07)。
 * 「中途失敗」以 `FormPublishHooks` 在指定檢查點丟錯模擬(TEST-07 的第二個接縫;理由見該檔註解)。
 */
describe("表單發布(四步、冪等重試、版本)", () => {
  let api: AuthTestApp;
  let connection: Connection;
  let token: string;
  let hooks: FormPublishHooks;

  beforeAll(async () => {
    api = await startAuthTestApp("cookhome-test-form-publish");
    connection = api.connection;
    token = await rootToken(api);
    hooks = api.app.get(FormPublishHooks);
  }, HOOK_TIMEOUT_MS);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await api.close();
  }, HOOK_TIMEOUT_MS);

  /** 第 `nth` 次走到 `checkpoint` 時丟錯(其餘照常)。 */
  function failAt(checkpoint: PublishCheckpoint, nth = 1): void {
    let seen = 0;
    jest.spyOn(hooks, "reached").mockImplementation((reached) => {
      if (reached === checkpoint) {
        seen += 1;
        if (seen === nth) {
          return Promise.reject(new Error(`injected failure at ${checkpoint}`));
        }
      }
      return Promise.resolve();
    });
  }

  function permissionsOf(formKey: string): Promise<PermissionDoc[]> {
    return connection
      .collection("permissions")
      .find<PermissionDoc>({
        key: {
          $regex: String.raw`^${MODULE_KEY}\.(show|edit)-${formKey}-`,
        },
      })
      .sort({ key: 1 })
      .toArray();
  }

  async function versionsOf(formKey: string): Promise<VersionRow[]> {
    const data = await ok<{
      formVersions: { items: VersionRow[] };
    }>(api, token, FORM_VERSIONS, { formKey });
    return data.formVersions.items;
  }

  /** 發布後的整體狀態(版本狀態、currentVersion、權限),去掉 formKey 以便兩張表單互比。 */
  async function stateOf(formKey: string): Promise<unknown> {
    const form = await getForm(api, token, formKey);
    const versions = await versionsOf(formKey);
    const permissions = await permissionsOf(formKey);
    return {
      currentVersion: form.currentVersion,
      publishInterrupted: form.publishInterrupted,
      versions: versions.map((version) => ({
        version: version.version,
        status: version.status,
      })),
      permissions: permissions.map((permission) => ({
        key: permission.key.replace(formKey, "<form>"),
        name: permission.name.replace(formKey, "<form>"),
        source: permission.source,
        retired: permission.retiredAt !== null,
      })),
    };
  }

  const v1Fields = [
    field("title", "text"),
    field("amount", "number", { permission: { show: true, edit: false } }),
    field("note", "text", { permission: { show: false, edit: true } }),
  ];
  const v2Fields = [
    field("title", "text"),
    field("amount", "number", {
      label: "內部金額",
      permission: { show: true, edit: true },
    }),
    field("memo", "text", { permission: { show: true, edit: false } }),
  ];

  it("四步完整走完:版號在搶鎖時配、權限建好且名稱 = 「表單名 / 欄位 label 可見 / 可改」、currentVersion 指向新版", async () => {
    await ok(api, token, CREATE_FORM, {
      input: { key: "pub_full", moduleKey: MODULE_KEY, name: "完整發布" },
    });
    const draft = await ok<{
      createFormVersionDraft: { formVersion: VersionRow };
    }>(api, token, CREATE_DRAFT, { input: { formKey: "pub_full" } });
    expect(draft.createFormVersionDraft.formVersion).toMatchObject({
      version: null,
      status: "DRAFT",
      draftRevision: 0,
    });
    const saved = await saveDefinition(
      api,
      token,
      "pub_full",
      definitionOf(v1Fields),
      0,
    );
    expect(saved.draftRevision).toBe(1);
    const published = await ok<{
      publishFormVersion: { formVersion: VersionRow };
    }>(api, token, PUBLISH, {
      input: {
        formKey: "pub_full",
        expectedDraftRevision: 1,
        changelog: "第一版",
      },
    });
    expect(published.publishFormVersion.formVersion).toMatchObject({
      version: 1,
      status: "PUBLISHED",
      changelog: "第一版",
    });
    const form = await getForm(api, token, "pub_full");
    expect(form).toMatchObject({
      currentVersion: 1,
      hasDraft: false,
      publishInterrupted: false,
    });
    const permissions = await permissionsOf("pub_full");
    expect(
      permissions.map(({ key, name, source, retiredAt }) => ({
        key,
        name,
        source,
        retiredAt,
      })),
    ).toEqual([
      {
        key: `${MODULE_KEY}.edit-pub_full-note`,
        name: "完整發布 / note 可改",
        source: "dynamic",
        retiredAt: null,
      },
      {
        key: showKey("pub_full", "amount"),
        name: "完整發布 / amount 可見",
        source: "dynamic",
        retiredAt: null,
      },
    ]);
    const audit = await connection
      .collection("audit_logs")
      .findOne({ action: "form-version.publish" });
    expect(audit?.after).toMatchObject({ formKey: "pub_full", version: 1 });
  });

  it("發布下一版:前一版自動退役、權限依新版建 / 退役、`name` 隨 label 更新;以任一版本為基底開草稿", async () => {
    await publishNewForm(
      api,
      token,
      "pub_next",
      definitionOf(v1Fields),
      "下一版",
    );
    const v2 = await publishDefinition(
      api,
      token,
      "pub_next",
      definitionOf(v2Fields),
      1,
    );
    expect(v2.version).toBe(2);
    const versions = await versionsOf("pub_next");
    expect(
      versions.map((version) => [version.version, version.status]),
    ).toEqual([
      [2, "PUBLISHED"],
      [1, "RETIRED"],
    ]);
    const permissions = await permissionsOf("pub_next");
    const byKey = new Map(permissions.map((doc) => [doc.key, doc]));
    expect(byKey.get(showKey("pub_next", "amount"))).toMatchObject({
      name: "下一版 / 內部金額 可見",
      retiredAt: null,
    });
    expect(
      byKey.get(`${MODULE_KEY}.edit-pub_next-amount`)?.retiredAt,
    ).toBeNull();
    expect(byKey.get(showKey("pub_next", "memo"))?.retiredAt).toBeNull();
    // v2 不再宣告 note 的 edit → 退役(不刪)
    expect(
      byKey.get(`${MODULE_KEY}.edit-pub_next-note`)?.retiredAt,
    ).toBeInstanceOf(Date);

    // 以已退役的 v1 為基底開草稿:複製 v1 的欄位,記 baseVersion
    const draft = await ok<{
      createFormVersionDraft: { formVersion: VersionRow };
    }>(api, token, CREATE_DRAFT, {
      input: { formKey: "pub_next", baseVersion: 1 },
    });
    expect(draft.createFormVersionDraft.formVersion.baseVersion).toBe(1);
    expect(
      draft.createFormVersionDraft.formVersion.fields.map((item) => item.key),
    ).toEqual(["title", "amount", "note"]);
    // 已有草稿 → 409
    const again = await call(api, token, CREATE_DRAFT, {
      input: { formKey: "pub_next", baseVersion: 2 },
    });
    expect(codeOf(again)).toBe("CONFLICT");
    expect(extensionsOf(again).reason).toBe("DRAFT_EXISTS");

    // 恢復舊欄位 → 權限復活(同一筆,不是新建)
    const noteBefore = byKey.get(`${MODULE_KEY}.edit-pub_next-note`);
    const saved = await ok<{
      saveFormVersionDraft: { formVersion: VersionRow };
    }>(api, token, SAVE_DRAFT, {
      input: {
        formKey: "pub_next",
        expectedDraftRevision: 0,
        ...definitionOf(v1Fields),
      },
    });
    await ok(api, token, PUBLISH, {
      input: {
        formKey: "pub_next",
        expectedDraftRevision:
          saved.saveFormVersionDraft.formVersion.draftRevision,
        changelog: "恢復 note",
      },
    });
    const afterRevive = await permissionsOf("pub_next");
    const revived = afterRevive.find(
      (doc) => doc.key === `${MODULE_KEY}.edit-pub_next-note`,
    );
    expect(revived?.retiredAt).toBeNull();
    expect(String(revived?._id)).toBe(String(noteBefore?._id));
  });

  it("`expectedDraftRevision` 不符:存草稿與發布都 409,資料不動", async () => {
    await ok(api, token, CREATE_FORM, {
      input: { key: "pub_stale", moduleKey: MODULE_KEY, name: "過期" },
    });
    await ok(api, token, CREATE_DRAFT, { input: { formKey: "pub_stale" } });
    await saveDefinition(api, token, "pub_stale", definitionOf(v1Fields), 0);
    const staleSave = await call(api, token, SAVE_DRAFT, {
      input: {
        formKey: "pub_stale",
        expectedDraftRevision: 0,
        ...definitionOf(v2Fields),
      },
    });
    expect(codeOf(staleSave)).toBe("CONFLICT");
    expect(extensionsOf(staleSave).reason).toBe("DRAFT_REVISION_MISMATCH");
    const stalePublish = await call(api, token, PUBLISH, {
      input: {
        formKey: "pub_stale",
        expectedDraftRevision: 0,
        changelog: "x",
      },
    });
    expect(codeOf(stalePublish)).toBe("CONFLICT");
    const draft = await ok<{ formVersion: { formVersion: VersionRow } }>(
      api,
      token,
      FORM_VERSION,
      { formKey: "pub_stale" },
    );
    expect(draft.formVersion.formVersion).toMatchObject({
      status: "DRAFT",
      draftRevision: 1,
      version: null,
    });
  });

  it("兩個發布同時送出:只有一個成功,另一個 409;版號只配一次", async () => {
    await ok(api, token, CREATE_FORM, {
      input: { key: "pub_race", moduleKey: MODULE_KEY, name: "競速" },
    });
    await ok(api, token, CREATE_DRAFT, { input: { formKey: "pub_race" } });
    await saveDefinition(api, token, "pub_race", definitionOf(v1Fields), 0);
    const input = {
      input: { formKey: "pub_race", expectedDraftRevision: 1, changelog: "搶" },
    };
    const results = await Promise.all([
      call(api, token, PUBLISH, input),
      call(api, token, PUBLISH, input),
    ]);
    const codes = results
      .map((result) => codeOf(result) ?? "OK")
      .toSorted((a, b) => a.localeCompare(b));
    expect(codes).toEqual(["CONFLICT", "OK"]);
    const versions = await versionsOf("pub_race");
    expect(versions.map((version) => version.version)).toEqual([1]);
  });

  it("檢查器有錯就不能發布(什麼都沒改);錯誤帶定位", async () => {
    await ok(api, token, CREATE_FORM, {
      input: { key: "pub_invalid", moduleKey: MODULE_KEY, name: "有錯" },
    });
    await ok(api, token, CREATE_DRAFT, { input: { formKey: "pub_invalid" } });
    const invalid = definitionOf([
      field("title", "text"),
      field("title", "text"),
    ]);
    await saveDefinition(api, token, "pub_invalid", invalid, 0);
    const result = await call(api, token, PUBLISH, {
      input: {
        formKey: "pub_invalid",
        expectedDraftRevision: 1,
        changelog: "x",
      },
    });
    expect(codeOf(result)).toBe("VALIDATION_FAILED");
    const issues = extensionsOf(result).issues as { code: string }[];
    expect(issues.map((issue) => issue.code)).toContain("KEY_DUPLICATE");
    const form = await getForm(api, token, "pub_invalid");
    expect(form).toMatchObject({ currentVersion: null, hasDraft: true });
  });

  it("發布中斷時禁止開草稿 / 退役 / 再發布;重試完成後恢復", async () => {
    await publishNewForm(api, token, "pub_blocked", definitionOf(v1Fields));
    await ok(api, token, CREATE_DRAFT, {
      input: { formKey: "pub_blocked", baseVersion: 1 },
    });
    await saveDefinition(api, token, "pub_blocked", definitionOf(v2Fields), 0);
    failAt("publish-version");
    const failed = await call(api, token, PUBLISH, {
      input: {
        formKey: "pub_blocked",
        expectedDraftRevision: 1,
        changelog: "中斷",
      },
    });
    expect(failed.errors).toBeDefined();
    jest.restoreAllMocks();

    expect(await getForm(api, token, "pub_blocked")).toMatchObject({
      publishInterrupted: true,
      currentVersion: 1,
    });
    // 填寫者仍看舊版(currentVersion 還沒切)
    const forms = await ok<{
      moduleForms: { key: string; currentVersion: number }[];
    }>(api, token, MODULE_FORMS, { moduleKey: MODULE_KEY });
    expect(
      forms.moduleForms.find((item) => item.key === "pub_blocked")
        ?.currentVersion,
    ).toBe(1);

    for (const [query, input] of [
      [CREATE_DRAFT, { formKey: "pub_blocked" }],
      [RETIRE_CURRENT, { formKey: "pub_blocked" }],
      [
        PUBLISH,
        { formKey: "pub_blocked", expectedDraftRevision: 1, changelog: "x" },
      ],
    ] as const) {
      const blocked = await call(api, token, query, { input });
      expect(codeOf(blocked)).toBe("CONFLICT");
      expect(extensionsOf(blocked).reason).toBe("PUBLISH_IN_PROGRESS");
    }

    const retried = await ok<{
      retryPublishFormVersion: { formVersion: VersionRow };
    }>(api, token, RETRY_PUBLISH, { input: { formKey: "pub_blocked" } });
    expect(retried.retryPublishFormVersion.formVersion).toMatchObject({
      version: 2,
      status: "PUBLISHED",
    });
    expect(await getForm(api, token, "pub_blocked")).toMatchObject({
      publishInterrupted: false,
      currentVersion: 2,
    });
    // 沒有中斷可重試 → 409
    const nothing = await call(api, token, RETRY_PUBLISH, {
      input: { formKey: "pub_blocked" },
    });
    expect(extensionsOf(nothing).reason).toBe("PUBLISH_NOT_INTERRUPTED");
  });

  describe("步驟 3 / 4 中途失敗後重試,結果與一次成功相同", () => {
    let baseline: unknown;

    beforeAll(async () => {
      await publishNewForm(api, token, "pub_base", definitionOf(v1Fields));
      await publishDefinition(
        api,
        token,
        "pub_base",
        definitionOf(v2Fields),
        1,
      );
      baseline = await stateOf("pub_base");
    }, HOOK_TIMEOUT_MS);

    const cases: [string, PublishCheckpoint, number][] = [
      ["步驟 3:建第二筆權限時失敗", "permission", 2],
      ["步驟 3:退役權限時失敗", "retire-permission", 1],
      ["步驟 4:切換前一版為退役時失敗", "retire-previous", 1],
      ["步驟 4:最後一筆(currentVersion)失敗", "current-version", 1],
    ];

    it.each(cases)("%s", async (_label, checkpoint, nth) => {
      const formKey = `pub_${checkpoint.replaceAll("-", "_")}_${String(nth)}`;
      await publishNewForm(api, token, formKey, definitionOf(v1Fields));
      await ok(api, token, CREATE_DRAFT, {
        input: { formKey, baseVersion: 1 },
      });
      await saveDefinition(api, token, formKey, definitionOf(v2Fields), 0);
      failAt(checkpoint, nth);
      const failed = await call(api, token, PUBLISH, {
        input: { formKey, expectedDraftRevision: 1, changelog: "測試發布" },
      });
      expect(failed.errors).toBeDefined();
      jest.restoreAllMocks();
      const interrupted = await getForm(api, token, formKey);
      expect(interrupted.publishInterrupted).toBe(true);

      await ok(api, token, RETRY_PUBLISH, { input: { formKey } });
      // 再重試一次也不會改變結果(冪等)
      await call(api, token, RETRY_PUBLISH, { input: { formKey } });
      expect(await stateOf(formKey)).toEqual(
        JSON.parse(JSON.stringify(baseline).replaceAll("pub_base", formKey)),
      );
    });
  });

  it("退役目前版本:版本改 retired、currentVersion → null,之後不可新增;再發布才恢復", async () => {
    await publishNewForm(
      api,
      token,
      "pub_retire",
      definitionOf([field("title", "text")]),
    );
    const retired = await ok<{ retireCurrentVersion: { form: unknown } }>(
      api,
      token,
      RETIRE_CURRENT,
      { input: { formKey: "pub_retire" } },
    );
    expect(retired.retireCurrentVersion.form).toMatchObject({
      currentVersion: null,
    });
    const versions = await versionsOf("pub_retire");
    expect(versions[0]?.status).toBe("RETIRED");
    const forms = await ok<{ moduleForms: { key: string }[] }>(
      api,
      token,
      MODULE_FORMS,
      { moduleKey: MODULE_KEY },
    );
    expect(forms.moduleForms.map((item) => item.key)).not.toContain(
      "pub_retire",
    );
    const create = await call(api, token, CREATE_FORM_DRAFT, {
      input: { formKey: "pub_retire", clientRequestId: nextRequestId() },
    });
    expect(codeOf(create)).toBe("FORBIDDEN");
    expect(extensionsOf(create).reason).toBe("FORM_NOT_AVAILABLE");
    // 沒有目前版本時再退役 → 409
    const again = await call(api, token, RETIRE_CURRENT, {
      input: { formKey: "pub_retire" },
    });
    expect(extensionsOf(again).reason).toBe("NO_CURRENT_VERSION");

    await publishDefinition(
      api,
      token,
      "pub_retire",
      definitionOf([field("title", "text")]),
      1,
    );
    const after = await ok<{ moduleForms: { key: string }[] }>(
      api,
      token,
      MODULE_FORMS,
      { moduleKey: MODULE_KEY },
    );
    expect(after.moduleForms.map((item) => item.key)).toContain("pub_retire");
  });
});
