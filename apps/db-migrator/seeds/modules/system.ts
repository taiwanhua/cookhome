import {
  type ModuleSeedDeclaration,
  permissionKey,
} from "../module-declaration";

export const SYSTEM_GROUP_KEY = "system";
export const ORG_MANAGER_KEY = `${SYSTEM_GROUP_KEY}.org-manager`;
export const TENANT_OPS_KEY = `${ORG_MANAGER_KEY}.tenant-ops`;
export const USER_MANAGER_KEY = `${SYSTEM_GROUP_KEY}.user-manager`;

/**
 * 治理模組(CONTEXT.md「治理模組」):管平台結構本身,隨底座出貨。
 * 節點正本:docs/modules/org-manager.md、user-manager.md、role-manager.md、
 * module-manager.md、field-manager.md、data-scope.md;模組 key 累加父 key(`system.` 前綴,2026-09-17 定案),
 * route 維持 key 末段。
 *
 * 樹全種、權限只種有正本的(#29 留言定案):組織管理(含租戶作業)與使用者管理的權限表已有正本(#133),
 * 其餘治理模組待各 docs/modules/<key>.md 補上權限表後再種;每個模組的 wildcard 由 seeds/modules.ts 自動產生。
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
      key: ORG_MANAGER_KEY,
      name: "組織管理",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 1,
      route: "org-manager",
    },
    {
      // 純權限容器:不在側欄、沒有路由(彈窗仍開在組織管理頁上),
      // 標 isRootOnly 讓租戶管理員模板整個模組被扣除(docs/modules/org-manager.md;ADR-0009 第 3 步)
      key: TENANT_OPS_KEY,
      name: "租戶作業",
      sidebarType: "hidden",
      parentKey: ORG_MANAGER_KEY,
      order: 1,
      isRootOnly: true,
      description:
        "根組織專屬動作的權限容器:開通租戶、轉移擁有者、設定可見範圍(無路由、不在側欄)",
    },
    {
      key: USER_MANAGER_KEY,
      name: "使用者管理",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 2,
      route: "user-manager",
    },
    {
      key: `${SYSTEM_GROUP_KEY}.role-manager`,
      name: "角色管理",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 3,
      route: "role-manager",
    },
    {
      key: `${SYSTEM_GROUP_KEY}.module-manager`,
      name: "模組與權限",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 4,
      route: "module-manager",
      // 根組織專屬,租戶不可見(docs/modules/module-manager.md;ADR-0009)
      isRootOnly: true,
    },
    {
      key: `${SYSTEM_GROUP_KEY}.field-manager`,
      name: "欄位管理",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 5,
      route: "field-manager",
    },
    {
      key: `${SYSTEM_GROUP_KEY}.data-scope`,
      name: "資料範圍",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 6,
      route: "data-scope",
      // 根組織專屬,租戶不可見(docs/modules/data-scope.md;ADR-0008)
      isRootOnly: true,
    },
  ],
  // 個別權限(綁「按鈕 / 欄位所在的那一頁」,ADR-0004);正本 = 兩份模組文件的權限表
  permissions: [
    // 組織管理(docs/modules/org-manager.md 權限表)
    {
      key: permissionKey(ORG_MANAGER_KEY, "view"),
      moduleKey: ORG_MANAGER_KEY,
      name: "檢視",
      description: "看組織樹與組織資料(名稱、描述、商標、狀態、擁有者)",
    },
    {
      key: permissionKey(ORG_MANAGER_KEY, "create-child"),
      moduleKey: ORG_MANAGER_KEY,
      name: "新增子組織",
      description: "「新增子組織」按鈕 + API:在選中的組織下建一個子組織",
    },
    {
      key: permissionKey(ORG_MANAGER_KEY, "edit"),
      moduleKey: ORG_MANAGER_KEY,
      name: "編輯",
      description: "「編輯」按鈕 + API:名稱、描述、商標",
    },
    {
      key: permissionKey(ORG_MANAGER_KEY, "toggle-enabled"),
      moduleKey: ORG_MANAGER_KEY,
      name: "停用 / 啟用",
      description: "「停用 / 啟用」按鈕 + API:停用連動整棵子樹",
    },
    {
      key: permissionKey(ORG_MANAGER_KEY, "move"),
      moduleKey: ORG_MANAGER_KEY,
      name: "搬移",
      description: "「搬移」動作 + API:改上層組織,限同一租戶",
    },
    {
      key: permissionKey(ORG_MANAGER_KEY, "delete"),
      moduleKey: ORG_MANAGER_KEY,
      name: "刪除",
      description: "「刪除」按鈕 + API:前置檢查通過才可(軟刪除)",
    },
    // 租戶作業(根組織專屬;同一份權限表的後三列)
    {
      key: permissionKey(TENANT_OPS_KEY, "provision"),
      moduleKey: TENANT_OPS_KEY,
      name: "開通租戶",
      description: "「開通租戶」按鈕 + API(ADR-0009 四步 + 擁有者 + 啟用信)",
    },
    {
      key: permissionKey(TENANT_OPS_KEY, "transfer-owner"),
      moduleKey: TENANT_OPS_KEY,
      name: "轉移擁有者",
      description: "編輯租戶頂層時的「擁有者」欄位 + API(v1 僅根組織可轉移)",
    },
    {
      key: permissionKey(TENANT_OPS_KEY, "set-visibility"),
      moduleKey: TENANT_OPS_KEY,
      name: "設定可見範圍",
      description:
        "編輯租戶頂層時的「使用者可見下層組織資料」開關 + API(settings.visibility)",
    },
    // 使用者管理(docs/modules/user-manager.md 權限表)
    {
      key: permissionKey(USER_MANAGER_KEY, "view"),
      moduleKey: USER_MANAGER_KEY,
      name: "檢視",
      description: "看使用者清單與單筆資料(基本欄位、所屬組織、角色、狀態)",
    },
    {
      key: permissionKey(USER_MANAGER_KEY, "create"),
      moduleKey: USER_MANAGER_KEY,
      name: "新增",
      description: "「新增使用者」按鈕 + API(含選擇啟用方式)",
    },
    {
      key: permissionKey(USER_MANAGER_KEY, "edit"),
      moduleKey: USER_MANAGER_KEY,
      name: "編輯",
      description:
        "「編輯」按鈕 + API:姓名、暱稱、性別、電話、地址、Email、帳號",
    },
    {
      key: permissionKey(USER_MANAGER_KEY, "toggle-enabled"),
      moduleKey: USER_MANAGER_KEY,
      name: "停用 / 啟用",
      description:
        "「停用 / 啟用」按鈕 + API;停用即刻作廢該使用者全部 refresh token",
    },
    {
      key: permissionKey(USER_MANAGER_KEY, "manage-orgs"),
      moduleKey: USER_MANAGER_KEY,
      name: "管理所屬組織",
      description:
        "「選擇所屬組織」彈窗 + API:加入 / 移除所屬組織(含移除時的 dry-run 與三檔)",
    },
    {
      key: permissionKey(USER_MANAGER_KEY, "assign-roles"),
      moduleKey: USER_MANAGER_KEY,
      name: "指派角色",
      description: "「指派角色」彈窗 + API:授予 / 解除角色(防越權,ADR-0003)",
    },
    {
      key: permissionKey(USER_MANAGER_KEY, "show-national-id"),
      moduleKey: USER_MANAGER_KEY,
      name: "身分證字號可見",
      description: "欄位級:詳情 / 編輯彈窗顯示解密後的值;無此權限 API 投影排除",
    },
    {
      key: permissionKey(USER_MANAGER_KEY, "edit-national-id"),
      moduleKey: USER_MANAGER_KEY,
      name: "身分證字號可改",
      description: "欄位級:無此權限硬送寫入 → API 拒",
    },
  ],
};
