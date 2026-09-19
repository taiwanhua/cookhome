import { ModuleSidebarType, OrgVisibility } from "@repo/graphql";

import type {
  TestModuleOption,
  TestOrg,
  TestOrgNode,
  TestOrgUser,
} from "./org-manager-handlers";

/**
 * 組織管理頁的夾具(與 `module-fixtures.ts` 同一個位置的用意:一份形狀,測試檔只寫行為)。
 * 三棵樹是**同一份資料的三種管理範圍**(#187):管理範圍是全部 → 看得到根與所有租戶;
 * 擁有組織是租戶頂層 → 樹根就是自己的頂層;擁有組織是兩個部門 → 兩個樹根。
 *
 * `parentId` 一律是真的上層,即使它不在樹上(api `buildForest` 的規則);
 * `outOfScope` 恆為 false — 管理範圍外的組織根本不回傳。
 */
const node = (
  id: string,
  name: string,
  parentId: string | null,
  overrides: Partial<TestOrgNode> = {},
): TestOrgNode => ({
  id,
  name,
  parentId,
  enabled: true,
  outOfScope: false,
  ownerUserId: null,
  children: [],
  ...overrides,
});

const contentChild = node("org-editors", "A-1-1 編輯組", "org-content");
// 停用連動整棵子樹(api 的規則),所以分店停用時它的下層也是停用
const storeChild = node("org-counter", "A-2-1 門市櫃台", "org-store", {
  enabled: false,
});

const tenantChildren: TestOrgNode[] = [
  node("org-content", "A-1 內容組", "org-tenant-a", {
    children: [contentChild],
  }),
  node("org-store", "A-2 台北分店", "org-tenant-a", {
    enabled: false,
    children: [storeChild],
  }),
];

/** 根組織視角:樹根是根組織(`parentId` 為 null),它的直接子組織才是租戶。 */
export const rootTree: TestOrgNode[] = [
  node("org-root", "CookHome", null, {
    children: [
      node("org-tenant-a", "租戶 A", "org-root", {
        ownerUserId: "user-owner",
        children: tenantChildren,
      }),
      node("org-tenant-b", "租戶 B", "org-root", { ownerUserId: "user-b" }),
    ],
  }),
];

/**
 * 租戶視角:樹根就是租戶頂層。**樹根的 `parentId` 是 null** —
 * api 的 `buildForest` 把本棵樹的根一律對外回 null(`orgs.service.ts`,orgs.test.ts 亦有斷言),
 * 所以前端不能拿 `parentId` 判斷視角(#186 ④)。
 */
export const tenantTree: TestOrgNode[] = [
  node("org-tenant-a", "租戶 A", null, {
    ownerUserId: "user-owner",
    children: tenantChildren,
  }),
];

/**
 * 多根視角(#187):持有兩個擁有組織是部門、彼此沒有共同上層的角色 →
 * 管理範圍 = 兩棵子樹的聯集,樹有**兩個根**,共同上層(租戶頂層)不在樹上。
 * 兩個根的 `parentId` 同樣是 null(`buildForest` 對每棵樹的根都這樣回)。
 */
export const multiRootTree: TestOrgNode[] = [
  node("org-content", "A-1 內容組", null, { children: [contentChild] }),
  node("org-store", "A-2 台北分店", null, {
    enabled: false,
    children: [storeChild],
  }),
];

const org = (
  id: string,
  name: string,
  parentId: string | null,
  overrides: Partial<TestOrg> = {},
): TestOrg => ({
  id,
  name,
  description: null,
  parentId,
  enabled: true,
  isSystem: false,
  ownerUserId: null,
  visibility: null,
  logoUrl: null,
  ...overrides,
});

/** `org(id)` 的來源:只有租戶頂層有 `ownerUserId` / `visibility`(api 的規則,`orgs/org-mapper.ts`)。 */
export const orgDetails: TestOrg[] = [
  org("org-root", "CookHome", null, { isSystem: true }),
  org("org-tenant-a", "租戶 A", "org-root", {
    description: "示範租戶",
    ownerUserId: "user-owner",
    visibility: OrgVisibility.Own,
    logoUrl: "https://cdn.test/tenant-a.png",
  }),
  org("org-content", "A-1 內容組", "org-tenant-a", {
    description: "負責食譜內容產出與審核",
  }),
  org("org-store", "A-2 台北分店", "org-tenant-a", { enabled: false }),
  org("org-editors", "A-1-1 編輯組", "org-content"),
  org("org-counter", "A-2-1 門市櫃台", "org-store", { enabled: false }),
];

const user = (id: string, name: string, enabled = true): TestOrgUser => ({
  id,
  account: id,
  name,
  email: `${id}@cookhome.online`,
  enabled,
  orgs: [{ id: "org-tenant-a", name: "租戶 A" }],
  roles: [],
});

export const orgUsers: TestOrgUser[] = [
  user("user-owner", "何家華"),
  user("user-new", "王小明"),
  user("user-off", "離職者", false),
];

const moduleOption = (
  id: string,
  key: string,
  name: string,
  parentId: string | null,
  order: number,
  sidebarType = ModuleSidebarType.Link,
): TestModuleOption => ({ id, key, name, parentId, order, sidebarType });

/** `tenantModuleOptions`:根組織專屬的兩個模組已由種子扣除,所以清單裡沒有它們(ADR-0009)。 */
export const tenantModuleOptions: TestModuleOption[] = [
  moduleOption("m-overview", "overview", "總覽", null, 0),
  moduleOption(
    "m-system",
    "system",
    "系統管理",
    null,
    1,
    ModuleSidebarType.Group,
  ),
  moduleOption("m-org", "system.org-manager", "組織管理", "m-system", 1),
  moduleOption("m-user", "system.user-manager", "使用者管理", "m-system", 2),
];
