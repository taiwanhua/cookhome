import { isValidOrgSlug } from "@repo/domain/form";

import type { OrgsRepository } from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import { orgValidationError } from "./org-error";

/**
 * 租戶短碼(`orgs.slug`)的格式:正本在 `@repo/domain/form` 的 `ORG_SLUG_PATTERN`
 * (`^[a-z][a-z0-9_]{1,19}$`),前後端同一條。去掉前後空白後判斷;不合 → `VALIDATION_FAILED`。
 */
export function requireSlug(value: string): string {
  const slug = value.trim();
  if (!isValidOrgSlug(slug)) {
    throw orgValidationError(`slug ${slug} must match ^[a-z][a-z0-9_]{1,19}$`, [
      "slug",
    ]);
  }
  return slug;
}

/**
 * 短碼全域唯一(`orgs.slug` 唯一索引);先查一次給出可標到欄位的錯誤,
 * 同時送出的兩個請求仍由唯一索引兜底。呼叫端是根組織的操作者(開通 / 改短碼都是根組織專屬),
 * 管理範圍 = 全部,查得到每一個租戶頂層。
 */
export async function assertSlugFree(
  orgs: OrgsRepository,
  operator: OperatorContext,
  slug: string,
): Promise<void> {
  const clash = await orgs.findOne(
    { ...operator, managedOrgIds: "all", visibleOrgIds: "all" },
    { slug },
    { includeDeleted: true },
  );
  if (clash) {
    throw orgValidationError("Already taken: slug", ["slug"]);
  }
}
