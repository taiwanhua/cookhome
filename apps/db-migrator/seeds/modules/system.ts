import type { ModuleSeedDeclaration } from "../module-declaration";

export const SYSTEM_GROUP_KEY = "system";

/**
 * 治理模組(CONTEXT.md「治理模組」):管平台結構本身,隨底座出貨。
 * 節點正本:docs/modules/org-manager.md、user-manager.md、role-manager.md、
 * module-manager.md、field-manager.md、data-scope.md(模組 key 皆標「暫定」,照文件種)。
 *
 * 樹全種、權限只種有正本的(#29 留言定案):治理模組權限表尚無正本,待各 docs/modules/<key>.md
 * 補上後再由該段 seed;因此本檔沒有 permissions。
 */
export const systemModules: ModuleSeedDeclaration = {
  nodes: [
    {
      key: SYSTEM_GROUP_KEY,
      name: "系統管理",
      sidebarType: "group",
      parentKey: null,
      order: 1,
      route: "system",
      description:
        "治理模組群組:組織、使用者、角色、模組與權限、欄位管理、資料範圍",
    },
    {
      key: "org-manager",
      name: "組織管理",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 1,
      route: "org-manager",
    },
    {
      key: "user-manager",
      name: "使用者管理",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 2,
      route: "user-manager",
    },
    {
      key: "role-manager",
      name: "角色管理",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 3,
      route: "role-manager",
    },
    {
      key: "module-manager",
      name: "模組與權限",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 4,
      route: "module-manager",
      // 根組織專屬,租戶不可見(docs/modules/module-manager.md;ADR-0009)
      isRootOnly: true,
    },
    {
      key: "field-manager",
      name: "欄位管理",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 5,
      route: "field-manager",
    },
    {
      key: "data-scope",
      name: "資料範圍",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 6,
      route: "data-scope",
      // 根組織專屬,租戶不可見(docs/modules/data-scope.md;ADR-0008)
      isRootOnly: true,
    },
  ],
};
