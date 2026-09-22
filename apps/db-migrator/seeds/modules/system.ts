import {
  type ModuleSeedDeclaration,
  permissionKey,
} from "../module-declaration";

export const SYSTEM_GROUP_KEY = "system";
export const ORG_MANAGER_KEY = `${SYSTEM_GROUP_KEY}.org-manager`;
export const TENANT_OPS_KEY = `${ORG_MANAGER_KEY}.tenant-ops`;
export const USER_MANAGER_KEY = `${SYSTEM_GROUP_KEY}.user-manager`;
export const ROLE_MANAGER_KEY = `${SYSTEM_GROUP_KEY}.role-manager`;
export const MODULE_MANAGER_KEY = `${SYSTEM_GROUP_KEY}.module-manager`;
export const FIELD_MANAGER_KEY = `${SYSTEM_GROUP_KEY}.field-manager`;
export const DATA_SCOPE_KEY = `${SYSTEM_GROUP_KEY}.data-scope`;

/**
 * 治理模組(CONTEXT.md「治理模組」):管平台結構本身,隨底座出貨。
 * 節點正本:docs/modules/org-manager.md、user-manager.md、role-manager.md、
 * module-manager.md、field-manager.md、data-scope.md;模組 key 累加父 key(`system.` 前綴,2026-09-17 定案),
 * route 維持 key 末段。
 *
 * 六個治理模組的權限表皆已有正本(組織管理 / 使用者管理 #133;角色管理、模組與權限、欄位管理、
 * 資料範圍 2026-09-20 補於各 docs/modules/<key>.md「權限表」節,#202 種下),
 * 每個模組的 wildcard 由 seeds/modules.ts 自動產生。
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
      icon: "settings",
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
      icon: "business",
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
      icon: "key",
      description:
        "根組織專屬動作的權限容器:開通租戶、撤銷開通、轉移擁有者(無路由、不在側欄)",
    },
    {
      key: USER_MANAGER_KEY,
      name: "使用者管理",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 2,
      route: "user-manager",
      icon: "people",
    },
    {
      key: ROLE_MANAGER_KEY,
      name: "角色管理",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 3,
      route: "role-manager",
      icon: "shield",
    },
    {
      key: MODULE_MANAGER_KEY,
      name: "模組與權限",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 4,
      route: "module-manager",
      icon: "apps",
      // 根組織專屬,租戶不可見(docs/modules/module-manager.md;ADR-0009)
      isRootOnly: true,
    },
    {
      key: FIELD_MANAGER_KEY,
      name: "欄位管理",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 5,
      route: "field-manager",
      icon: "label",
    },
    {
      key: DATA_SCOPE_KEY,
      name: "資料範圍",
      sidebarType: "link",
      parentKey: SYSTEM_GROUP_KEY,
      order: 6,
      route: "data-scope",
      icon: "filter",
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
    {
      key: permissionKey(ORG_MANAGER_KEY, "set-visibility"),
      moduleKey: ORG_MANAGER_KEY,
      name: "設定可見範圍",
      description:
        "編輯自己租戶頂層時的「使用者可見下層組織資料」開關 + API(settings.visibility)",
    },
    // 租戶作業(根組織專屬;同一份權限表的後兩列)
    {
      key: permissionKey(TENANT_OPS_KEY, "provision"),
      moduleKey: TENANT_OPS_KEY,
      name: "開通租戶",
      description: "「開通租戶」按鈕 + API(ADR-0009 四步 + 擁有者 + 啟用信)",
    },
    {
      key: permissionKey(TENANT_OPS_KEY, "revoke-provision"),
      moduleKey: TENANT_OPS_KEY,
      name: "撤銷開通",
      description:
        "「撤銷開通」按鈕 + API:反向抹掉開通建出的租戶頂層、擁有者帳號、租戶管理員副本(僅限租戶底下沒有其他資料時)",
    },
    {
      key: permissionKey(TENANT_OPS_KEY, "transfer-owner"),
      moduleKey: TENANT_OPS_KEY,
      name: "轉移擁有者",
      description: "編輯租戶頂層時的「擁有者」欄位 + API(v1 僅根組織可轉移)",
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
    // 角色管理(docs/modules/role-manager.md 權限表)
    {
      key: permissionKey(ROLE_MANAGER_KEY, "view"),
      moduleKey: ROLE_MANAGER_KEY,
      name: "檢視",
      description: "看角色清單與單筆(權限矩陣、分配使用者兩個頁籤)",
    },
    {
      key: permissionKey(ROLE_MANAGER_KEY, "create"),
      moduleKey: ROLE_MANAGER_KEY,
      name: "新增",
      description:
        "「新增角色」按鈕 + API(擁有組織限操作者管理範圍內,預設當前組織)",
    },
    {
      key: permissionKey(ROLE_MANAGER_KEY, "edit"),
      moduleKey: ROLE_MANAGER_KEY,
      name: "編輯",
      description: "「編輯」按鈕 + API:名稱、描述",
    },
    {
      key: permissionKey(ROLE_MANAGER_KEY, "edit-matrix"),
      moduleKey: ROLE_MANAGER_KEY,
      name: "編輯權限矩陣",
      description:
        "權限矩陣「儲存」+ API(role_module / role_permission 整份覆蓋;subset-only 防越權;租戶副本只能縮不能擴)",
    },
    {
      key: permissionKey(ROLE_MANAGER_KEY, "assign-users"),
      moduleKey: ROLE_MANAGER_KEY,
      name: "分配使用者",
      description:
        "分配使用者頁籤的「加入使用者」「移除」+ API(user_role;候選 = 所屬組織在角色擁有組織子樹內)",
    },
    {
      key: permissionKey(ROLE_MANAGER_KEY, "toggle-enabled"),
      moduleKey: ROLE_MANAGER_KEY,
      name: "停用 / 啟用",
      description: "停用 / 啟用角色 + API(停用後持有者的該角色立即不生效)",
    },
    {
      key: permissionKey(ROLE_MANAGER_KEY, "delete"),
      moduleKey: ROLE_MANAGER_KEY,
      name: "刪除",
      description: "刪除角色 + API(前置:無授予、非種子角色、非租戶副本;軟刪除)",
    },
    // 模組與權限(docs/modules/module-manager.md 權限表;模組本身 isRootOnly)
    {
      key: permissionKey(MODULE_MANAGER_KEY, "view"),
      moduleKey: MODULE_MANAGER_KEY,
      name: "檢視",
      description: "看模組樹與各模組的權限清單(唯讀)",
    },
    {
      key: permissionKey(MODULE_MANAGER_KEY, "toggle-enabled"),
      moduleKey: MODULE_MANAGER_KEY,
      name: "停用 / 啟用",
      description:
        "模組 / 權限的 enabled 切換 + API(停用父模組連動整棵子樹;停用權限 = 全域 kill switch)",
    },
    {
      key: permissionKey(MODULE_MANAGER_KEY, "set-icon"),
      moduleKey: MODULE_MANAGER_KEY,
      name: "更換側欄圖示",
      description:
        "模組的側欄圖示選擇器 + API(白名單 key;清空回預設)。與停用 / 啟用分開:換圖示不影響任何人的權限",
    },
    // 欄位管理(docs/modules/field-manager.md 權限表)
    {
      key: permissionKey(FIELD_MANAGER_KEY, "view"),
      moduleKey: FIELD_MANAGER_KEY,
      name: "檢視",
      description: "看類別與選項(來源欄:全域 / <組織名稱> 自訂)",
    },
    {
      key: permissionKey(FIELD_MANAGER_KEY, "create"),
      moduleKey: FIELD_MANAGER_KEY,
      name: "新增選項",
      description:
        "「新增選項」+ API(本組織自訂,orgId = 當前組織;(categoryId, orgId, value) 唯一)",
    },
    {
      key: permissionKey(FIELD_MANAGER_KEY, "edit"),
      moduleKey: FIELD_MANAGER_KEY,
      name: "編輯",
      description:
        "編輯自訂選項的 label / order / description + API(種子選項只能改 enabled;value 建立後不可改)",
    },
    {
      key: permissionKey(FIELD_MANAGER_KEY, "toggle-enabled"),
      moduleKey: FIELD_MANAGER_KEY,
      name: "停用 / 啟用",
      description: "停用 / 啟用選項 + API(種子與自訂皆可;選項不可刪)",
    },
    // 資料範圍(docs/modules/data-scope.md 權限表;模組本身 isRootOnly)
    {
      key: permissionKey(DATA_SCOPE_KEY, "view"),
      moduleKey: DATA_SCOPE_KEY,
      name: "檢視",
      description: "看資料目標清單與各目標的規則",
    },
    {
      key: permissionKey(DATA_SCOPE_KEY, "edit"),
      moduleKey: DATA_SCOPE_KEY,
      name: "編輯",
      description:
        "規則編輯器「儲存」+ API(整份 data_scope_rules 覆蓋;儲存即作廢記憶體快取)",
    },
  ],
};
