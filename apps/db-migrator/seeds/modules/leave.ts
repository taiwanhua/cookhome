import {
  type ModuleSeedDeclaration,
  permissionKey,
} from "../module-declaration";

export const LEAVE_KEY = "leave";

/** 提交狀態的資料範圍選項(值對照 `form_submissions.status`;綁流程的表單會走完七種)。 */
export const FORM_SUBMISSION_STATUS_OPTIONS = [
  { value: "draft", label: "草稿" },
  { value: "reviewing", label: "審核中" },
  { value: "returned", label: "已退回" },
  { value: "withdrawn", label: "已撤回" },
  { value: "completed", label: "已完成" },
  { value: "rejected", label: "已駁回" },
  { value: "voided", label: "已作廢" },
];

/**
 * 請假:表單模組範例(`engine: "form"`,同 6a 購物清單的形狀;正本 Spec 6b §2、§8)。
 * 綁審核流程的示範對象(購物清單保持不綁流程,當對照組)。表單與流程都是執行期資料,
 * 不在 seed:由根組織與租戶在畫面上建、綁定,E2E 自己建。
 */
export const leaveModule: ModuleSeedDeclaration = {
  nodes: [
    {
      key: LEAVE_KEY,
      name: "請假",
      sidebarType: "link",
      parentKey: null,
      order: 5,
      route: "leave",
      icon: "calendar",
      engine: "form",
      description:
        "表單模組範例(綁審核流程):欄位由表單設計,資料存 form_submissions",
    },
    {
      key: `${LEAVE_KEY}.view-page`,
      name: "詳情",
      sidebarType: "hidden",
      parentKey: LEAVE_KEY,
      order: 1,
      route: "view-page",
    },
    {
      key: `${LEAVE_KEY}.create-page`,
      name: "新增",
      sidebarType: "hidden",
      parentKey: LEAVE_KEY,
      order: 2,
      route: "create-page",
    },
    {
      key: `${LEAVE_KEY}.edit-page`,
      name: "編輯",
      sidebarType: "hidden",
      parentKey: LEAVE_KEY,
      order: 3,
      route: "edit-page",
    },
  ],
  permissions: [
    {
      key: permissionKey(LEAVE_KEY, "view"),
      moduleKey: LEAVE_KEY,
      name: "檢視",
      description: "看列表與單筆資料、進入詳情頁",
    },
    {
      key: permissionKey(LEAVE_KEY, "create"),
      moduleKey: LEAVE_KEY,
      name: "新增",
      description: "進入新增頁的按鈕 + 新增 API",
    },
    {
      key: permissionKey(LEAVE_KEY, "edit"),
      moduleKey: LEAVE_KEY,
      name: "編輯",
      description: "進入編輯頁的按鈕 + 編輯 API(綁流程的單核准後只能作廢)",
    },
    {
      key: permissionKey(LEAVE_KEY, "delete"),
      moduleKey: LEAVE_KEY,
      name: "刪除",
      description: "列表的刪除按鈕 + 刪除 API",
    },
  ],
  dataScopeTarget: {
    collection: "form_submissions",
    name: "請假",
    description: "請假的表單提交(form_submissions 裡 moduleKey = leave 的資料)",
    fields: [
      {
        name: "status",
        label: "狀態",
        type: "enum",
        options: FORM_SUBMISSION_STATUS_OPTIONS,
      },
    ],
  },
};
