import { hash } from "@node-rs/argon2";
import type { Db } from "mongodb";

import type { SeedRootAdminSet } from "./seed-declaration";

export const ROOT_ADMIN_ENV_NAMES = [
  "ROOT_ADMIN_ACCOUNT",
  "ROOT_ADMIN_EMAIL",
  "ROOT_ADMIN_PASSWORD",
] as const;

interface RootAdminInput {
  account: string;
  email: string;
  password: string;
}

export type RootAdminOutcome = "created" | "unchanged";

/** 三個變數缺一即失敗(雲端存 Secret Manager,見 docs/env-registry.md)。 */
export function readRootAdminInput(env: NodeJS.ProcessEnv): RootAdminInput {
  const missing = ROOT_ADMIN_ENV_NAMES.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `缺少 root 初始帳號環境變數:${missing.join("、")}(ADR-0002;雲端存 Secret Manager)`,
    );
  }
  return {
    account: env.ROOT_ADMIN_ACCOUNT ?? "",
    email: env.ROOT_ADMIN_EMAIL ?? "",
    password: env.ROOT_ADMIN_PASSWORD ?? "",
  };
}

/**
 * 僅在帳號(account)不存在時建立;已存在則完全不動 — 部署重跑不得重設密碼。
 * 建立時一併寫入 org_user(所屬組織)與 user_role(角色授予)兩筆核心關聯(ADR-0001)。
 */
export async function ensureRootAdmin(
  database: Db,
  set: SeedRootAdminSet,
  input: RootAdminInput,
  now: Date,
): Promise<RootAdminOutcome> {
  const users = database.collection("users");
  const existing = await users.findOne({ account: input.account });
  if (existing) {
    return "unchanged";
  }

  const org = await database.collection("orgs").findOne({ key: set.orgKey });
  const role = await database.collection("roles").findOne({ key: set.roleKey });
  if (!org || !role) {
    throw new Error(
      `建立 root 初始帳號前需先種子化組織 ${set.orgKey} 與角色 ${set.roleKey}`,
    );
  }

  // argon2id(ADR-0003);@node-rs/argon2 預設即 argon2id
  const passwordHash = await hash(input.password);
  const { insertedId } = await users.insertOne({
    name: input.account,
    account: input.account,
    email: input.email,
    passwordHash,
    enabled: true,
    settings: {},
    createdAt: now,
    updatedAt: now,
  });

  await database.collection("core_relationships").insertMany([
    {
      type: "org_user",
      firstId: org._id,
      secondId: insertedId,
      thirdId: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      type: "user_role",
      firstId: insertedId,
      secondId: role._id,
      thirdId: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  return "created";
}
