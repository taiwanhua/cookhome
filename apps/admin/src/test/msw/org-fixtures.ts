import { ModuleSidebarType, OrgVisibility } from "@repo/graphql";

import type {
  TestModuleOption,
  TestOrg,
  TestOrgNode,
  TestOrgUser,
} from "./org-manager-handlers";

/**
 * 組織管理頁的夾具(與 `module-fixtures.ts` 同一個位置的用意:一份形狀,測試檔只寫行為)。
 * 兩棵樹是**同一份資料的兩種視角**:根組織視角看得到根與所有租戶,租戶視角的樹根就是自己的頂層。
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

const tenantChildren: TestOrgNode[] = [
  node("org-content", "A-1 內容組", "org-tenant-a"),
  node("org-store", "A-2 台北分店", "org-tenant-a", { enabled: false }),
];

/** 根組織視角:樹根是根組織(`parentId` 為 null),它的直接子組織才是租戶。 */
export const rootTree: TestOrgNode[] = [
  node("org-root", "CookHome", null, {
    children: [
      node("org-tenant-a", "租戶 A", "org-root", {
        ownerUserId: "user-owner",
        children: tenantChildren,
      }),
      node("org-tenant-b", "租戶 B", "org-root", {
        ownerUserId: "user-b",
        outOfScope: true,
      }),
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
