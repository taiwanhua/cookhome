import {
  DataScopeAudienceType,
  DataScopeCombineOp,
  DataScopeFieldType,
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

/** 套用對象「指定角色」的清單(`roles` query;擁有組織在管理範圍內)。 */
export const dataScopeRoles: TestRole[] = [
  {
    id: "role-support",
    name: "客服",
    description: null,
    enabled: true,
    isSystem: false,
    isTemplateCopy: false,
    userCount: 2,
    ownerOrg: { id: "org-tenant-a", name: "租戶 A" },
  },
  {
    id: "role-editor",
    name: "編輯",
    description: null,
    enabled: true,
    isSystem: false,
    isTemplateCopy: false,
    userCount: 1,
    ownerOrg: { id: "org-tenant-a", name: "租戶 A" },
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
