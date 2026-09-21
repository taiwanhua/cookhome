import {
  DemoItemOneStatus,
  UploadPurpose,
  useAttachmentDownloadUrlQuery,
  useCreateDemoItemOneMutation,
  useDeleteDemoItemOneMutation,
  useDemoItemOneHistoryQuery,
  useDemoItemOneQuery,
  useDemoItemsOneQuery,
  useUpdateDemoItemOneMutation,
} from "@repo/graphql";

/**
 * 示範模組1 三頁的**單一設定物件**(#320)。
 *
 * 三頁(列表 / 詳情 / 新增 + 編輯共版型)要用到的東西一律集中在這裡:模組 key、權限 key、
 * 欄位定義、查詢 hooks、上傳規則、i18n namespace。頁面本身只描述「怎麼畫」,
 * 換一個模組要動的就只有這一份 —— #321 的示範模組2 與之後的 module-scaffold 據此抽共版型。
 *
 * 規則正本:`docs/modules/demo.sub.sample-one.md`(模組樹 / 權限表 / api 介面);
 * seed 正本:`apps/db-migrator/seeds/modules/demo.sub.sample-one.ts`。
 */

/** 列表頁(link)的模組 key;三個隱藏頁掛在它底下。 */
export const SAMPLE_ONE_MODULE_KEY = "demo.sub.sample-one";

/**
 * 四個模組 key = 四個頁面(ADR-0011「模組 = 頁面」)。
 * `module-pages.tsx` 四個 key 各登記一個元件;**沒綁該模組就進不去**,連帶「進入那一頁的按鈕」也不顯示。
 */
export const SAMPLE_ONE_MODULE_KEYS = {
  list: SAMPLE_ONE_MODULE_KEY,
  viewPage: `${SAMPLE_ONE_MODULE_KEY}.view-page`,
  createPage: `${SAMPLE_ONE_MODULE_KEY}.create-page`,
  editPage: `${SAMPLE_ONE_MODULE_KEY}.edit-page`,
} as const;

/**
 * 權限 key(正本見模組文件的權限表;判斷走 ADR-0011「頁內功能」)。
 *
 * **逐列的 `canEdit` / `canDelete` / `canEditInternalNote` 不在這裡** —— 那三個由 api 算在
 * `item.abilities` 上、已含權限判斷,前端直接用,不要再與 `usePermissions` 相乘(模組文件「回傳欄位的語意」)。
 * 這裡列的是「整頁層級」才問得到的:新增鈕、內部備註欄要不要渲染、兩個頁面自有區塊。
 */
export const SAMPLE_ONE_PERMISSIONS = {
  view: `${SAMPLE_ONE_MODULE_KEY}.view`,
  create: `${SAMPLE_ONE_MODULE_KEY}.create`,
  showInternalNote: `${SAMPLE_ONE_MODULE_KEY}.show-internal-note`,
  editInternalNote: `${SAMPLE_ONE_MODULE_KEY}.edit-internal-note`,
  showTips: `${SAMPLE_ONE_MODULE_KEYS.createPage}.show-tips`,
  showHistory: `${SAMPLE_ONE_MODULE_KEYS.editPage}.show-history`,
} as const;

/**
 * 分類下拉的選項來源:欄位管理的「示範分類」(`docs/modules/field-manager.md`「api 介面」)。
 * `fieldCategories` / `fields` 兩個 query 都掛在 `system.field-manager.view` 底下,
 * 所以沒有那個權限的人拿不到選項 —— 列表的分類篩選整個不顯示、表單的分類欄退成唯讀(見 `useDemoCategoryOptions`)。
 */
export const DEMO_CATEGORY_KEY = "demo-category";
export const FIELD_MANAGER_VIEW_PERMISSION = "system.field-manager.view";

/** i18n 的第二層 key(I18N-02);三頁共用同一個 namespace。 */
export const SAMPLE_ONE_I18N = "admin.demoSampleOne";

/** 列表每頁筆數(api `DemoItemsOneInput.pageSize` 上限 100)。 */
export const SAMPLE_ONE_PAGE_SIZE = 10;

/**
 * 列表的欄位定義(Figma 175:3 的表頭寬度)。`key` 同時是 i18n 的欄名 key 與 `TableColumn.key`;
 * 畫法在 `SampleOneTable.tsx` 逐欄實作,這裡只定「有哪些欄、多寬、哪一欄是主要識別欄」。
 */
export const SAMPLE_ONE_COLUMNS = [
  { key: "name", width: 150, isEmphasized: true },
  { key: "category", width: 110 },
  { key: "note" },
  { key: "status", width: 90 },
  { key: "enabled", width: 80 },
  { key: "actions", width: 150 },
] as const;

/** 表格最小寬度(STYLE-11:六欄不折行的合理寬度)。 */
export const SAMPLE_ONE_TABLE_MIN_WIDTH = 960;

/** 狀態下拉的選項順序(值的正本是 seed 的資料範圍宣告與 schema 的 `status`)。 */
export const SAMPLE_ONE_STATUSES = [
  DemoItemOneStatus.Draft,
  DemoItemOneStatus.Published,
  DemoItemOneStatus.Archived,
] as const;

/**
 * 上傳規則(ADR-0010;api 正本 `apps/api/src/storage/upload-rules.ts`)。
 * 封面走公開 bucket(回穩定 URL,可直接放 `<img src>`),附件走私有 bucket(下載時才現簽)。
 *
 * 兩者的 `accept` 目前都只有圖片:api 的 `UPLOAD_EXTENSIONS` 只收 png / jpg / webp,
 * 送別種 content type 在 `createUploadUrl` 那一步就會被拒(設計稿畫的 pdf 附件現在上傳不了,PR 有記)。
 */
export const SAMPLE_ONE_UPLOAD = {
  cover: {
    purpose: UploadPurpose.DemoCover,
    accept: ["image/png", "image/jpeg", "image/webp"] as readonly string[],
    maxSize: 2 * 1024 * 1024,
  },
  attachment: {
    purpose: UploadPurpose.DemoAttachment,
    accept: ["image/png", "image/jpeg", "image/webp"] as readonly string[],
    maxSize: 2 * 1024 * 1024,
  },
} as const;

/**
 * 三頁用到的 codegen hooks(STRUCT-04:只走 `@repo/graphql` 的出口)。
 * 集中在這裡,換模組時只換這一塊;頁面在**模組層**解構成具名 hook 再呼叫
 * (`const { useList } = SAMPLE_ONE_QUERIES;`),react-hooks 的規則才認得出那是 hook。
 */
export const SAMPLE_ONE_QUERIES = {
  useList: useDemoItemsOneQuery,
  useItem: useDemoItemOneQuery,
  useHistory: useDemoItemOneHistoryQuery,
  useDownloadUrl: useAttachmentDownloadUrlQuery,
  useCreate: useCreateDemoItemOneMutation,
  useUpdate: useUpdateDemoItemOneMutation,
  useDelete: useDeleteDemoItemOneMutation,
} as const;
