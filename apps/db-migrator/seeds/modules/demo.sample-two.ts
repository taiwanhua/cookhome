import {
  type ModuleSeedDeclaration,
  permissionKey,
  wildcardPermission,
} from "../module-declaration";
import { DEMO_FAMILY_ENABLED, DEMO_GROUP_KEY } from "./demo.sub.sample-one";

export const SAMPLE_TWO_KEY = "demo.sample-two";

/**
 * 示範模組2(正本:docs/modules/demo.sample-two.md):示範家族的對照組 —
 * 掛示範群組直下(兩層結構)、不宣告 dataScopeTarget、只有基本五筆權限。
 */
export const sampleTwoModule: ModuleSeedDeclaration = {
  nodes: [
    {
      key: SAMPLE_TWO_KEY,
      name: "示範模組2",
      sidebarType: "link",
      parentKey: DEMO_GROUP_KEY,
      order: 2,
      route: "sample-two",
      description: "示範家族的對照組:兩層結構、無資料範圍目標、只有基本權限",
      enabled: DEMO_FAMILY_ENABLED,
    },
    {
      key: `${SAMPLE_TWO_KEY}.view-page`,
      name: "詳情",
      sidebarType: "hidden",
      parentKey: SAMPLE_TWO_KEY,
      order: 1,
      route: "view-page",
      enabled: DEMO_FAMILY_ENABLED,
    },
    {
      key: `${SAMPLE_TWO_KEY}.create-page`,
      name: "新增",
      sidebarType: "hidden",
      parentKey: SAMPLE_TWO_KEY,
      order: 2,
      route: "create-page",
      enabled: DEMO_FAMILY_ENABLED,
    },
    {
      key: `${SAMPLE_TWO_KEY}.edit-page`,
      name: "編輯",
      sidebarType: "hidden",
      parentKey: SAMPLE_TWO_KEY,
      order: 3,
      route: "edit-page",
      enabled: DEMO_FAMILY_ENABLED,
    },
  ],
  // 語意與示範模組1 對應權限相同,全綁示範模組2(列表頁)
  permissions: [
    wildcardPermission(SAMPLE_TWO_KEY, "示範模組2"),
    {
      key: permissionKey(SAMPLE_TWO_KEY, "view"),
      moduleKey: SAMPLE_TWO_KEY,
      name: "檢視",
      description: "看列表與單筆資料、進入檢視頁/打開檢視跳窗",
    },
    {
      key: permissionKey(SAMPLE_TWO_KEY, "create"),
      moduleKey: SAMPLE_TWO_KEY,
      name: "新增",
      description: "進入新增頁的按鈕 + 新增 API",
    },
    {
      key: permissionKey(SAMPLE_TWO_KEY, "edit"),
      moduleKey: SAMPLE_TWO_KEY,
      name: "編輯",
      description: "進入編輯頁的按鈕 + 編輯 API",
    },
    {
      key: permissionKey(SAMPLE_TWO_KEY, "delete"),
      moduleKey: SAMPLE_TWO_KEY,
      name: "刪除",
      description: "列表的刪除按鈕 + 刪除 API",
    },
  ],
};
