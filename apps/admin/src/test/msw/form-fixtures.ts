import type { FieldDef, FormDefinition } from "@repo/domain/form";
import {
  type FormFieldsFragment,
  type FormSubmissionFieldsFragment,
  FormSubmissionStatus,
  type FormVersionFieldsFragment,
  FormVersionStatus,
  ModuleSidebarType,
} from "@repo/graphql";

import { rawOf } from "@/lib/form-engine/definition";

import type { TestModule } from "./auth-handlers";

/**
 * 表單引擎的測試夾具(形狀以 api 的回傳為準:`apps/api/src/forms/**\/*.test.ts` 的斷言、
 * `packages/graphql/src/documents/forms.graphql` / `form-submissions.graphql` 的 fragment;TEST-08 / TEST-12)。
 *
 * 範例表單「購物清單」(`shopping_list`,掛在 `shopping-list` 模組):品項(必填)、數量、單價、
 * 總價(計算:數量 × 單價)、備註(數量 > 0 才顯示)、採購人(帶入目標)、內部備註(限定可改,帶入目標)。
 */
export const SHOPPING_LIST_KEY = "shopping-list";
export const SHOPPING_FORM_KEY = "shopping_list";

export const SHOPPING_ROUTES = {
  list: "/shopping-list",
  viewPage: "/shopping-list/view-page",
  createPage: "/shopping-list/create-page",
  editPage: "/shopping-list/edit-page",
} as const;

export const FORMS_ROUTE = "/system/forms";

const moduleOf = (
  id: string,
  key: string,
  name: string,
  parentId: string | null,
  sidebarType: ModuleSidebarType,
  route: string,
  permissions: readonly string[],
): TestModule => ({
  id,
  key,
  name,
  parentId,
  sidebarType,
  order: 3,
  route,
  icon: null,
  permissions: [...permissions],
});

/** `me.modules`:購物清單 + 三個隱藏頁(seed `shopping-list.ts` 的形狀);權限全掛在列表那一層。 */
export const shoppingListModules = (
  permissions: readonly string[],
): TestModule[] => [
  moduleOf(
    "m-shop",
    SHOPPING_LIST_KEY,
    "購物清單",
    null,
    ModuleSidebarType.Link,
    SHOPPING_ROUTES.list,
    permissions,
  ),
  moduleOf(
    "m-shop-view",
    `${SHOPPING_LIST_KEY}.view-page`,
    "詳情",
    "m-shop",
    ModuleSidebarType.Hidden,
    SHOPPING_ROUTES.viewPage,
    [],
  ),
  moduleOf(
    "m-shop-create",
    `${SHOPPING_LIST_KEY}.create-page`,
    "新增",
    "m-shop",
    ModuleSidebarType.Hidden,
    SHOPPING_ROUTES.createPage,
    [],
  ),
  moduleOf(
    "m-shop-edit",
    `${SHOPPING_LIST_KEY}.edit-page`,
    "編輯",
    "m-shop",
    ModuleSidebarType.Hidden,
    SHOPPING_ROUTES.editPage,
    [],
  ),
];

/** `me.modules`:系統管理 → 表單管理。 */
export const formsModules = (permissions: readonly string[]): TestModule[] => [
  moduleOf(
    "m-system",
    "system",
    "系統管理",
    null,
    ModuleSidebarType.Group,
    "/system",
    [],
  ),
  moduleOf(
    "m-forms",
    "system.forms",
    "表單管理",
    "m-system",
    ModuleSidebarType.Link,
    FORMS_ROUTE,
    permissions,
  ),
];

/** 一個欄位定義(測試用預設:文字框、使用者填、非必填、不受保護)。 */
export const field = (
  key: string,
  label: string,
  type: FieldDef["type"],
  overrides: Partial<FieldDef> = {},
): FieldDef => ({
  key,
  label,
  type,
  widget: { kind: "textField" },
  valueSource: { kind: "input" },
  options: null,
  rules: { required: false },
  permission: { show: false, edit: false },
  help: null,
  ...overrides,
});

export const shoppingDefinition = (): FormDefinition => ({
  fields: [
    field("item", "品項", "text", { rules: { required: true } }),
    field("qty", "數量", "number", {
      precision: 0,
      widget: { kind: "number" },
    }),
    field("unit_price", "單價", "number", {
      precision: 0,
      widget: { kind: "number", unit: "元" },
    }),
    field("total", "總價", "number", {
      precision: 0,
      widget: { kind: "number", unit: "元" },
      valueSource: {
        kind: "computed",
        expr: { "*": [{ var: "qty" }, { var: "unit_price" }] },
      },
    }),
    field("note", "備註", "multiline", {
      widget: { kind: "textArea" },
      visibleWhen: { ">": [{ var: "qty" }, 0] },
    }),
    field("buyer", "採購人", "text"),
    field("internal_note", "內部備註", "text", {
      permission: { show: false, edit: true },
    }),
  ],
  layout: {
    sections: [
      {
        key: "basic",
        title: "採購內容",
        rows: [
          {
            cols: [
              { fieldKey: "item", span: 6 },
              { fieldKey: "qty", span: 6 },
            ],
          },
          {
            cols: [
              { fieldKey: "unit_price", span: 6 },
              { fieldKey: "total", span: 6 },
            ],
          },
          { cols: [{ fieldKey: "note", span: 12 }] },
          {
            cols: [
              { fieldKey: "buyer", span: 6 },
              { fieldKey: "internal_note", span: 6 },
            ],
          },
        ],
      },
    ],
  },
  summaryMap: { title: "item", date: null, amount: "total" },
  prefills: [
    {
      label: "從使用者帶入",
      source: { provider: "user", labelField: "name" },
      mapping: [
        { sourceField: "name", fieldKey: "buyer" },
        { sourceField: "email", fieldKey: "internal_note" },
      ],
    },
  ],
});

const STAMP = "2026-09-20T08:00:00.000Z";

export const versionFragment = (
  definition: FormDefinition,
  overrides: Partial<FormVersionFieldsFragment> = {},
): FormVersionFieldsFragment => ({
  id: `ver-${SHOPPING_FORM_KEY}-${String(overrides.version ?? "draft")}`,
  formKey: SHOPPING_FORM_KEY,
  version: null,
  status: FormVersionStatus.Draft,
  draftRevision: 1,
  baseVersion: null,
  ...rawOf(definition),
  changelog: null,
  publishedAt: null,
  publishedBy: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...overrides,
});

export const formFragment = (
  overrides: Partial<FormFieldsFragment> = {},
): FormFieldsFragment => ({
  id: `form-${overrides.key ?? SHOPPING_FORM_KEY}`,
  key: SHOPPING_FORM_KEY,
  moduleKey: SHOPPING_LIST_KEY,
  moduleName: "購物清單",
  name: "購物單",
  isShared: true,
  ownerOrgId: null,
  ownerOrgName: null,
  forkedFrom: null,
  currentVersion: 1,
  tabLabelTemplate: null,
  hasDraft: true,
  publishInterrupted: false,
  tenantEnabled: null,
  assignments: [],
  abilities: {
    canEdit: true,
    canAssign: true,
    canSetEnabled: false,
    canFork: true,
  },
  // api 在 root 視角與沒綁時回 null(docs/modules/workflows.md「流程綁定」)
  workflowBinding: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...overrides,
});

export const submissionFragment = (
  overrides: Partial<FormSubmissionFieldsFragment> = {},
): FormSubmissionFieldsFragment => ({
  id: "sub-1",
  moduleKey: SHOPPING_LIST_KEY,
  formKey: SHOPPING_FORM_KEY,
  formName: "購物單",
  version: 1,
  status: FormSubmissionStatus.Completed,
  revision: 1,
  viewedRevision: 1,
  values: {
    item: "雞蛋",
    qty: "2",
    unit_price: "30",
    total: "60",
    note: "要放山",
    buyer: null,
    internal_note: null,
  },
  fieldStates: [],
  displayValues: [],
  summary: { title: "雞蛋", date: STAMP, amount: "60" },
  ctx: { at: STAMP, timezone: "Asia/Taipei", userId: "user-1", orgId: "org-1" },
  revisions: [{ revision: 1, at: STAMP, user: { id: "user-1", name: "小華" } }],
  editVersion: 2,
  orgId: "org-1",
  createdBy: { id: "user-1", name: "小華" },
  submittedAt: STAMP,
  createdAt: STAMP,
  updatedAt: STAMP,
  currentInstanceId: null,
  blocked: false,
  voidedAt: null,
  voidReason: null,
  replacedById: null,
  copiedFrom: null,
  abilities: {
    canEdit: true,
    canDelete: true,
    canEditField: ["item", "qty", "unit_price", "note", "buyer"],
    canWithdraw: false,
    canVoid: false,
    canCopy: false,
  },
  ...overrides,
});
