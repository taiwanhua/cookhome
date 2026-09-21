import {
  DataScopeAudienceType,
  DataScopeCombineOp,
  DataScopeFieldType,
  RoleKind,
} from "@repo/graphql";

import type {
  TestDataScopeRule,
  TestDataScopeTarget,
  TestRole,
} from "./data-scope-handlers";

/**
 * 資料範圍頁的夾具(一份形狀,測試檔只寫行為)。
 *
 * **與 api 對齊的地方**:欄位目錄 = seed 宣告的業務欄位在前、底座自動掛入的六個基礎欄位殿後,
 * 型別與順序照 `apps/api/src/data-scope/data-scope.test.ts`「底座的六個基礎欄位」那條斷言。
 * **刻意與 seed 不同的地方**:現行 seed 的 `demo_items_one` 宣告 `fields: []`(只有基礎欄位),
 * 這裡多給一個 enum 欄位「狀態」— enum 的值來源要有東西可選才驗得到(設計稿 167:1867 也是這個例子);
 * 第二個目標 `demo_items_two` 只為了驗左清單的切換與「已設規則」標籤。
 */
const baseFields: TestDataScopeTarget["fields"] = [
  {
    name: "orgId",
    label: "組織",
    type: DataScopeFieldType.Org,
    isBase: true,
    options: [],
  },
  {
    name: "createdBy",
    label: "建立者",
    type: DataScopeFieldType.User,
    isBase: true,
    options: [],
  },
  {
    name: "updatedBy",
    label: "更新者",
    type: DataScopeFieldType.User,
    isBase: true,
    options: [],
  },
  {
    name: "createdAt",
    label: "建立時間",
    type: DataScopeFieldType.Date,
    isBase: true,
    options: [],
  },
  {
    name: "updatedAt",
    label: "更新時間",
    type: DataScopeFieldType.Date,
    isBase: true,
    options: [],
  },
  {
    name: "deletedAt",
    label: "刪除時間",
    type: DataScopeFieldType.Date,
    isBase: true,
    options: [],
  },
];

export const dataScopeTargets: TestDataScopeTarget[] = [
  {
    collection: "demo_items_one",
    name: "示範項目",
    description: "示範模組1 的資料",
    fields: [
      {
        name: "status",
        label: "狀態",
        type: DataScopeFieldType.Enum,
        isBase: false,
        options: [
          { value: "draft", label: "草稿" },
          { value: "published", label: "已發布" },
        ],
      },
      ...baseFields,
    ],
  },
  {
    collection: "demo_items_two",
    name: "示範項目2",
    description: "示範模組2 的資料",
    fields: baseFields,
  },
];

/** 自建角色的四個動作(#261;非 root 視角、沒人持有 → 全開)。 */
const CUSTOM_ABILITIES = {
  canEdit: true,
  canEditMatrix: true,
  canToggleEnabled: true,
  canDelete: true,
};

/** 預設角色(租戶副本):改得動、矩陣編得動,但停用只有 root、一律不可刪。 */
const TEMPLATE_COPY_ABILITIES = {
  canEdit: true,
  canEditMatrix: true,
  canToggleEnabled: false,
  canDelete: false,
};

const tenantA = {
  id: "org-tenant-a",
  name: "租戶 A",
  tenantTop: { id: "org-tenant-a", name: "租戶 A" },
};
const tenantB = {
  id: "org-tenant-b",
  name: "租戶 B",
  tenantTop: { id: "org-tenant-b", name: "租戶 B" },
};

/**
 * 套用對象「指定角色」的清單(`roles` query;擁有組織在管理範圍內)。
 * 刻意放兩個同名的「租戶管理員」分屬兩個租戶 —— 這正是 #261 的 8 要解決的情形:
 * 根組織視角下只看角色名稱完全分不出來,要靠「名稱 — 擁有組織」與租戶分組。
 */
export const dataScopeRoles: TestRole[] = [
  {
    id: "role-support",
    name: "客服",
    description: null,
    enabled: true,
    kind: RoleKind.Custom,
    abilities: CUSTOM_ABILITIES,
    isSystem: false,
    isTemplateCopy: false,
    userCount: 2,
    ownerOrg: tenantA,
  },
  {
    id: "role-editor",
    name: "編輯",
    description: null,
    enabled: true,
    kind: RoleKind.Custom,
    abilities: CUSTOM_ABILITIES,
    isSystem: false,
    isTemplateCopy: false,
    userCount: 1,
    ownerOrg: tenantA,
  },
  {
    id: "role-admin-a",
    name: "租戶管理員",
    description: null,
    enabled: true,
    kind: RoleKind.TemplateCopy,
    abilities: TEMPLATE_COPY_ABILITIES,
    isSystem: false,
    isTemplateCopy: true,
    userCount: 1,
    ownerOrg: tenantA,
  },
  {
    id: "role-admin-b",
    name: "租戶管理員",
    description: null,
    enabled: true,
    kind: RoleKind.TemplateCopy,
    abilities: TEMPLATE_COPY_ABILITIES,
    isSystem: false,
    isTemplateCopy: true,
    userCount: 1,
    ownerOrg: tenantB,
  },
];

/**
 * 已存在的一份規則(正本 `docs/modules/data-scope.md` 的 JSON 示例的同一個形狀):
 * 客服只看自己建立的,且(組織不是台北分店 或 建立時間在 2026 年間)。
 */
export const savedRule: TestDataScopeRule = {
  collection: "demo_items_one",
  combineOp: DataScopeCombineOp.Or,
  updatedAt: "2026-09-20T02:00:00.000Z",
  rules: [
    {
      audience: { type: DataScopeAudienceType.Role, ids: ["role-support"] },
      filter: {
        op: "AND",
        children: [
          {
            field: "createdBy",
            cond: "in",
            value: { kind: "dynamic", ref: "current-user" },
          },
          {
            op: "OR",
            children: [
              {
                field: "orgId",
                cond: "not-in",
                value: { kind: "static", values: ["org-store"] },
              },
              {
                field: "createdAt",
                cond: "between",
                value: { kind: "static", values: ["2026-01-01", "2026-12-31"] },
              },
            ],
          },
        ],
      },
    },
  ],
};
