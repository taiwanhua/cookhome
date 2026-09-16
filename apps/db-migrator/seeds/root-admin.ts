import type { SeedRootAdminSet } from "../src/seed/seed-declaration";
import { ROOT_ORG_KEY } from "./orgs";
import { SUPER_ADMIN_ROLE_KEY } from "./roles";

/**
 * root 初始超級管理員帳號(ADR-0002):account/email/密碼來自
 * ROOT_ADMIN_ACCOUNT / ROOT_ADMIN_EMAIL / ROOT_ADMIN_PASSWORD(docs/env-registry.md)。
 * 僅在帳號不存在時建立:加入根組織 + 授予超級管理員角色;已存在則完全不動。
 */
export const rootAdmin: SeedRootAdminSet = {
  kind: "root-admin",
  orgKey: ROOT_ORG_KEY,
  roleKey: SUPER_ADMIN_ROLE_KEY,
};
