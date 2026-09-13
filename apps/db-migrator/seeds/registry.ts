import type { SeedRegistry } from "../src/seed/seed-declaration";
import { orgs } from "./orgs";
import { roles } from "./roles";
import { rootAdmin } from "./root-admin";

/**
 * 收齊所有種子(正本:ADR-0002)。新增一類種子 = 新增一個宣告檔並在此註冊。
 * 順序即執行順序:被引用者在前(組織 → 角色 → root 初始帳號 → …)。
 */
export const seedRegistry: SeedRegistry = [orgs, roles, rootAdmin];
