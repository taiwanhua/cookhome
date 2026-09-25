import {
  type ModuleSeedDeclaration,
  permissionKey,
} from "../module-declaration";

export const SHOPPING_LIST_KEY = "shopping-list";

/**
 * 購物清單:表單模組的範例(`engine: "form"`,正本 Spec 6a §2「seed 宣告(表單模組)」)。
 *
 * 骨架照固定欄位模組的宣告方式 —— 三個 `-page` 隱藏頁、四筆個別權限、資料範圍目標;
 * 唯一的差別是 `engine: "form"`:頁面由表單引擎組裝、資料存所有表單模組共用的 `form_submissions`,
 * 資料範圍目標的 `moduleKey` 由 seed runner 填本模組 key(同一張表可以有多個表單模組各一個目標)。
 * 表單本身(欄位、版面、版本)不在 seed:由根組織與租戶在畫面上建。
 */
export const shoppingListModule: ModuleSeedDeclaration = {
  nodes: [
    {
      key: SHOPPING_LIST_KEY,
      name: "購物清單",
      sidebarType: "link",
      parentKey: null,
      order: 3,
      route: "shopping-list",
      icon: "store",
      engine: "form",
      description: "表單模組範例:欄位由表單設計,資料存 form_submissions",
    },
    {
      key: `${SHOPPING_LIST_KEY}.view-page`,
      name: "詳情",
      sidebarType: "hidden",
      parentKey: SHOPPING_LIST_KEY,
      order: 1,
      route: "view-page",
    },
    {
      key: `${SHOPPING_LIST_KEY}.create-page`,
      name: "新增",
      sidebarType: "hidden",
      parentKey: SHOPPING_LIST_KEY,
      order: 2,
      route: "create-page",
    },
    {
      key: `${SHOPPING_LIST_KEY}.edit-page`,
      name: "編輯",
      sidebarType: "hidden",
      parentKey: SHOPPING_LIST_KEY,
      order: 3,
      route: "edit-page",
    },
  ],
  permissions: [
    {
      key: permissionKey(SHOPPING_LIST_KEY, "view"),
      moduleKey: SHOPPING_LIST_KEY,
      name: "檢視",
      description: "看列表與單筆資料、進入詳情頁",
    },
    {
      key: permissionKey(SHOPPING_LIST_KEY, "create"),
      moduleKey: SHOPPING_LIST_KEY,
      name: "新增",
      description: "進入新增頁的按鈕 + 新增 API",
    },
    {
      key: permissionKey(SHOPPING_LIST_KEY, "edit"),
      moduleKey: SHOPPING_LIST_KEY,
      name: "編輯",
      description: "進入編輯頁的按鈕 + 編輯 API",
    },
    {
      key: permissionKey(SHOPPING_LIST_KEY, "delete"),
      moduleKey: SHOPPING_LIST_KEY,
      name: "刪除",
      description: "列表的刪除按鈕 + 刪除 API",
    },
  ],
  // collection 固定 form_submissions;moduleKey 由 runner 填本模組 key。
  // 欄位目錄 = 基礎欄位(程式自動附加)+ 提交狀態;表單自訂欄位進條件不在此範圍
  dataScopeTarget: {
    collection: "form_submissions",
    name: "購物清單",
    description:
      "購物清單的表單提交(form_submissions 裡 moduleKey = shopping-list 的資料)",
    fields: [
      {
        name: "status",
        label: "狀態",
        type: "enum",
        options: [
          { value: "draft", label: "草稿" },
          { value: "completed", label: "已完成" },
        ],
      },
    ],
  },
};
