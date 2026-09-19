import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { type Connection, Types } from "mongoose";

import {
  type AuthTestApp,
  ROOT_ADMIN,
  startAuthTestApp,
} from "../auth/test-support/auth-app";
import { createOrg, createUser } from "../auth/test-support/fixtures";
import { HOOK_TIMEOUT_MS } from "../database/test-support/mongo-connection";
import { createRole } from "../permission/test-support/fixtures";

const PASSWORD = ["test", "pass", "word"].join("-");

const LOGIN = /* GraphQL */ `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
    }
  }
`;

const FIELD_CATEGORIES = /* GraphQL */ `
  query FieldCategories {
    fieldCategories {
      items {
        id
        key
        name
      }
      totalCount
    }
  }
`;

const FIELDS = /* GraphQL */ `
  query Fields($categoryId: ID!) {
    fields(categoryId: $categoryId) {
      items {
        id
        categoryId
        label
        value
        order
        enabled
        description
        source
      }
      totalCount
    }
  }
`;

const CREATE_FIELD = /* GraphQL */ `
  mutation CreateField($input: CreateFieldInput!) {
    createField(input: $input) {
      field {
        id
        label
        value
        order
        enabled
        description
        source
      }
    }
  }
`;

const UPDATE_FIELD = /* GraphQL */ `
  mutation UpdateField($input: UpdateFieldInput!) {
    updateField(input: $input) {
      field {
        id
        label
        order
        description
      }
    }
  }
`;

const SET_FIELD_ENABLED = /* GraphQL */ `
  mutation SetFieldEnabled($input: SetFieldEnabledInput!) {
    setFieldEnabled(input: $input) {
      field {
        id
        enabled
        source
      }
    }
  }
`;

interface LoginData {
  login: { accessToken: string };
}

interface FieldRow {
  id: string;
  categoryId: string;
  label: string;
  value: string;
  order: number;
  enabled: boolean;
  description: string | null;
  source: "GLOBAL" | "OWN";
}

interface FieldsData {
  fields: { items: FieldRow[]; totalCount: number };
}

interface FieldCategoriesData {
  fieldCategories: {
    items: { id: string; key: string; name: string }[];
    totalCount: number;
  };
}

interface CreateFieldData {
  createField: { field: FieldRow };
}

interface UpdateFieldData {
  updateField: {
    field: { id: string; label: string; order: number; description: string | null };
  };
}

interface SetFieldEnabledData {
  setFieldEnabled: { field: { id: string; enabled: boolean; source: string } };
}

/** `audit_logs` 的一筆(欄位正本 `database/schemas/audit-log.schema.ts`)。 */
interface AuditRecord {
  action: string;
  targetType?: string;
  targetId?: Types.ObjectId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** 欄位管理權限表(field-manager.md)的四個 key。 */
const FIELD_PERMISSIONS = [
  "system.field-manager.view",
  "system.field-manager.create",
  "system.field-manager.edit",
  "system.field-manager.toggle-enabled",
];
/** 模組樹要給完整(綁下層必綁上層,ADR-0011 步驟 3)。 */
const FIELD_MODULES = ["system", "system.field-manager"];

/**
 * 欄位管理(#206:類別 / 合併清單 / 新增 / 編輯 / 停用 / 唯一索引 / 租戶隔離)。
 * 打真的 GraphQL 端點、對真 MongoDB(TEST-07);夾具沿用 auth / permission 的 test-support。
 *
 * 組織樹(root 為 seed 建的根組織):root ─┬─ 租戶甲  └─ 租戶乙
 * 種子內容(field-manager.md「種子內容」):`gender` 4 個選項、`demo-category` 3 個。
 */
describe("欄位管理(#206,GraphQL 端點 + 真 MongoDB)", () => {
  let api: AuthTestApp;
  let connection: Connection;

  let tenantA: Types.ObjectId;
  let tenantB: Types.ObjectId;
  let genderCategoryId: Types.ObjectId;
  let demoCategoryId: Types.ObjectId;

  let managerAToken: string;
  let managerBToken: string;
  let rootToken: string;

  let accountSequence = 0;

  function nextAccount(prefix: string): string {
    accountSequence += 1;
    return `${prefix}-${String(accountSequence)}`;
  }

  async function login(account: string, password = PASSWORD): Promise<string> {
    const result = await api.graphql<LoginData>(LOGIN, {
      input: { account, password },
    });
    expect(result.errors).toBeUndefined();
    const token = result.data?.login.accessToken;
    if (!token) {
      throw new Error(`登入失敗:${account}`);
    }
    return token;
  }

  /** 建一個持有欄位管理權限的操作者並登入(當前組織 = 第一個所屬組織)。 */
  async function createFieldManager(
    orgId: Types.ObjectId,
    permissionKeys: string[] = FIELD_PERMISSIONS,
  ): Promise<string> {
    const account = nextAccount("field-manager");
    const userId = await createUser(connection, {
      account,
      password: PASSWORD,
      orgIds: [orgId],
    });
    await createRole(api.app, connection, {
      name: `欄位管理角色:${account}`,
      ownerOrgId: orgId,
      moduleKeys: FIELD_MODULES,
      permissionKeys,
      assignTo: [userId],
    });
    return login(account);
  }

  async function findCategoryId(key: string): Promise<Types.ObjectId> {
    const category = await connection
      .collection("field_categories")
      .findOne<{ _id: Types.ObjectId }>({ key });
    if (!category) {
      throw new Error(`測試資料庫沒有欄位類別 key=${key}(seed 未跑?)`);
    }
    return category._id;
  }

  async function listFields(
    token: string,
    categoryId: Types.ObjectId,
  ): Promise<FieldRow[]> {
    const result = await api.graphql<FieldsData>(
      FIELDS,
      { categoryId: String(categoryId) },
      { accessToken: token },
    );
    expect(result.errors).toBeUndefined();
    if (!result.data) {
      throw new Error("fields 沒有回資料");
    }
    expect(result.data.fields.totalCount).toBe(result.data.fields.items.length);
    return result.data.fields.items;
  }

  /** 取合併清單裡符合條件的第一筆(找不到即測試前提壞了,直接拋)。 */
  async function findRow(
    token: string,
    categoryId: Types.ObjectId,
    predicate: (row: FieldRow) => boolean,
  ): Promise<FieldRow> {
    const rows = await listFields(token, categoryId);
    const found = rows.find((row) => predicate(row));
    if (!found) {
      throw new Error("合併清單裡找不到預期的選項");
    }
    return found;
  }

  async function createField(
    token: string,
    input: Record<string, unknown>,
  ): Promise<Awaited<ReturnType<AuthTestApp["graphql"]>>> {
    return api.graphql<CreateFieldData>(
      CREATE_FIELD,
      { input },
      { accessToken: token },
    );
  }

  function latestAudit(
    action: string,
    targetId?: Types.ObjectId,
  ): Promise<AuditRecord | null> {
    return connection
      .collection("audit_logs")
      .findOne<AuditRecord>(
        { action, ...(targetId ? { targetId } : {}) },
        { sort: { createdAt: -1, _id: -1 } },
      );
  }

  beforeAll(async () => {
    api = await startAuthTestApp("cookhome-test-fields");
    connection = api.connection;
    // 測試連線自建與 field.schema.ts 同一組唯一索引:Mongoose 的 autoIndex 建在 app 自己的連線上、
    // 完成時點不保證;索引宣告本身由 database/schemas/indexes.schema.test.ts 鎖定。
    await connection
      .collection("fields")
      .createIndex({ categoryId: 1, orgId: 1, value: 1 }, { unique: true });

    tenantA = await createOrg(connection, { name: "租戶甲" });
    tenantB = await createOrg(connection, { name: "租戶乙" });
    genderCategoryId = await findCategoryId("gender");
    demoCategoryId = await findCategoryId("demo-category");

    managerAToken = await createFieldManager(tenantA);
    managerBToken = await createFieldManager(tenantB);
    rootToken = await login(ROOT_ADMIN.account, ROOT_ADMIN.password);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await api.close();
  }, HOOK_TIMEOUT_MS);

  describe("讀", () => {
    it("fieldCategories 回種子的兩個全域類別", async () => {
      const result = await api.graphql<FieldCategoriesData>(
        FIELD_CATEGORIES,
        {},
        { accessToken: managerAToken },
      );
      expect(result.errors).toBeUndefined();
      const keys = result.data?.fieldCategories.items.map((row) => row.key);
      expect(keys).toEqual(["gender", "demo-category"]);
      expect(result.data?.fieldCategories.totalCount).toBe(2);
    });

    it("fields 回全域種子,依 order 排序、每筆 source=GLOBAL", async () => {
      const rows = await listFields(managerAToken, genderCategoryId);
      expect(rows.map((row) => row.value)).toEqual([
        "male",
        "female",
        "other",
        "undisclosed",
      ]);
      expect(rows.map((row) => row.source)).toEqual([
        "GLOBAL",
        "GLOBAL",
        "GLOBAL",
        "GLOBAL",
      ]);
      expect(rows.every((row) => row.enabled)).toBe(true);
    });

    it("沒有 view 權限 → FORBIDDEN", async () => {
      const token = await createFieldManager(tenantA, [
        "system.field-manager.create",
      ]);
      const result = await api.graphql(
        FIELDS,
        { categoryId: String(genderCategoryId) },
        { accessToken: token },
      );
      expect(result.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    });
  });

  describe("新增自訂選項", () => {
    it("建立後出現在合併清單、source=OWN、orgId = 當前組織,並寫審計 field.create", async () => {
      const result = await createField(managerAToken, {
        categoryId: String(demoCategoryId),
        label: "甜點",
        value: "dessert",
        order: 4,
        description: "租戶甲自訂",
      });
      expect(result.errors).toBeUndefined();
      const created = (result.data as CreateFieldData | null)?.createField
        .field;
      expect(created).toMatchObject({
        label: "甜點",
        value: "dessert",
        order: 4,
        enabled: true,
        description: "租戶甲自訂",
        source: "OWN",
      });

      const rows = await listFields(managerAToken, demoCategoryId);
      expect(rows.map((row) => row.value)).toEqual([
        "staple",
        "side-dish",
        "drink",
        "dessert",
      ]);
      expect(rows.at(-1)?.source).toBe("OWN");

      const stored = await connection
        .collection("fields")
        .findOne<{ orgId: Types.ObjectId | null; isSystem: boolean }>({
          _id: new Types.ObjectId(created?.id),
        });
      expect(String(stored?.orgId)).toBe(String(tenantA));
      expect(stored?.isSystem).toBe(false);

      const audit = await latestAudit(
        "field.create",
        new Types.ObjectId(created?.id),
      );
      expect(audit).toMatchObject({
        action: "field.create",
        targetType: "field",
      });
    });

    it("同類別同組織重複 value → FIELD_VALUE_DUPLICATE", async () => {
      const result = await createField(managerAToken, {
        categoryId: String(demoCategoryId),
        label: "甜點(重複)",
        value: "dessert",
      });
      expect(result.errors?.[0]?.extensions?.code).toBe(
        "FIELD_VALUE_DUPLICATE",
      );
    });

    it("與同類別的全域選項同 value → FIELD_VALUE_DUPLICATE(唯一索引擋不到,由表單驗證擋)", async () => {
      const result = await createField(managerAToken, {
        categoryId: String(demoCategoryId),
        label: "主食(自訂)",
        value: "staple",
      });
      expect(result.errors?.[0]?.extensions?.code).toBe(
        "FIELD_VALUE_DUPLICATE",
      );
    });

    it("不同組織可以有同一個 value", async () => {
      const result = await createField(managerBToken, {
        categoryId: String(demoCategoryId),
        label: "甜點",
        value: "dessert",
      });
      expect(result.errors).toBeUndefined();
      expect(
        (result.data as CreateFieldData | null)?.createField.field.source,
      ).toBe("OWN");
    });

    it("唯一索引擋下繞過表單驗證的重複(同 categoryId + orgId + value)", async () => {
      const now = new Date();
      await expect(
        connection.collection("fields").insertOne({
          categoryId: demoCategoryId,
          orgId: tenantA,
          label: "甜點(直接寫入)",
          value: "dessert",
          order: 9,
          enabled: true,
          isSystem: false,
          createdAt: now,
          updatedAt: now,
          createdBy: null,
          updatedBy: null,
          deletedAt: null,
        }),
      ).rejects.toMatchObject({ code: 11_000 });
    });

    it("查無類別 → NOT_FOUND;value 空白 → VALIDATION_FAILED", async () => {
      const missing = await createField(managerAToken, {
        categoryId: String(new Types.ObjectId()),
        label: "x",
        value: "x",
      });
      expect(missing.errors?.[0]?.extensions?.code).toBe("NOT_FOUND");

      const blank = await createField(managerAToken, {
        categoryId: String(demoCategoryId),
        label: "x",
        value: " ".repeat(3),
      });
      expect(blank.errors?.[0]?.extensions?.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("編輯", () => {
    it("種子選項 → FORBIDDEN(只能 setFieldEnabled)", async () => {
      const seed = await findRow(
        managerAToken,
        genderCategoryId,
        (row) => row.value === "male",
      );
      const result = await api.graphql(
        UPDATE_FIELD,
        { input: { id: seed.id, label: "先生" } },
        { accessToken: managerAToken },
      );
      expect(result.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    });

    it("自訂選項改得動 label / order / description,並寫審計 field.edit", async () => {
      const own = await findRow(
        managerAToken,
        demoCategoryId,
        (row) => row.source === "OWN",
      );
      const result = await api.graphql<UpdateFieldData>(
        UPDATE_FIELD,
        { input: { id: own.id, label: "點心", order: 7, description: null } },
        { accessToken: managerAToken },
      );
      expect(result.errors).toBeUndefined();
      expect(result.data?.updateField.field).toMatchObject({
        label: "點心",
        order: 7,
        description: null,
      });

      const audit = await latestAudit("field.edit", new Types.ObjectId(own.id));
      expect(audit?.before).toMatchObject({ label: "甜點" });
      expect(audit?.after).toMatchObject({ label: "點心", order: 7 });
    });

    it("別的組織的自訂選項 → NOT_FOUND(不在合併清單內)", async () => {
      const ownOfB = await findRow(
        managerBToken,
        demoCategoryId,
        (row) => row.source === "OWN",
      );
      const result = await api.graphql(
        UPDATE_FIELD,
        { input: { id: ownOfB.id, label: "被別人改" } },
        { accessToken: managerAToken },
      );
      expect(result.errors?.[0]?.extensions?.code).toBe("NOT_FOUND");
    });
  });

  describe("停用 / 啟用", () => {
    it("自訂選項:租戶自己切得動,並寫審計 field.toggle-enabled", async () => {
      const own = await findRow(
        managerAToken,
        demoCategoryId,
        (row) => row.source === "OWN",
      );
      const result = await api.graphql<SetFieldEnabledData>(
        SET_FIELD_ENABLED,
        { input: { id: own.id, enabled: false } },
        { accessToken: managerAToken },
      );
      expect(result.errors).toBeUndefined();
      expect(result.data?.setFieldEnabled.field.enabled).toBe(false);

      const audit = await latestAudit(
        "field.toggle-enabled",
        new Types.ObjectId(own.id),
      );
      expect(audit?.before).toMatchObject({ enabled: true });
      expect(audit?.after).toMatchObject({ enabled: false });
    });

    it("種子選項:租戶操作者 → FORBIDDEN(enabled 是全域開關)", async () => {
      const seed = await findRow(
        managerAToken,
        genderCategoryId,
        (row) => row.value === "undisclosed",
      );
      const result = await api.graphql(
        SET_FIELD_ENABLED,
        { input: { id: seed.id, enabled: false } },
        { accessToken: managerAToken },
      );
      expect(result.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    });

    it("種子選項:根組織操作者切得動,全域生效", async () => {
      const seed = await findRow(
        rootToken,
        genderCategoryId,
        (row) => row.value === "undisclosed",
      );
      const result = await api.graphql<SetFieldEnabledData>(
        SET_FIELD_ENABLED,
        { input: { id: seed.id, enabled: false } },
        { accessToken: rootToken },
      );
      expect(result.errors).toBeUndefined();
      expect(result.data?.setFieldEnabled.field).toMatchObject({
        enabled: false,
        source: "GLOBAL",
      });

      const seenByTenant = await findRow(
        managerAToken,
        genderCategoryId,
        (row) => row.value === "undisclosed",
      );
      expect(seenByTenant.enabled).toBe(false);
    });
  });

  describe("租戶隔離", () => {
    it("租戶甲看不到租戶乙的自訂選項(反之亦然)", async () => {
      const seenByA = await listFields(managerAToken, demoCategoryId);
      const seenByB = await listFields(managerBToken, demoCategoryId);
      // 兩邊各自只有一筆 OWN,且 id 不同(同 value、不同組織)
      const ownOfA = seenByA.filter((row) => row.source === "OWN");
      const ownOfB = seenByB.filter((row) => row.source === "OWN");
      expect(ownOfA).toHaveLength(1);
      expect(ownOfB).toHaveLength(1);
      expect(ownOfA[0]?.id).not.toBe(ownOfB[0]?.id);
      expect(
        seenByA.some((row) => row.id === ownOfB[0]?.id),
      ).toBe(false);
      expect(
        seenByB.some((row) => row.id === ownOfA[0]?.id),
      ).toBe(false);
    });

    it("根組織操作者的清單只含全域 + 根組織自己的自訂,不含租戶的", async () => {
      const rows = await listFields(rootToken, demoCategoryId);
      expect(rows.every((row) => row.source === "GLOBAL")).toBe(true);
      expect(rows).toHaveLength(3);
    });
  });
});
