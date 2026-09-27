import { useMe } from "./useMe";

/**
 * 讀者當前組織的**租戶時區**(IANA;api `me.currentOrg.timezone`,沒設 = `Asia/Taipei`)。
 * 表單引擎的日期時間欄在填寫、草稿、列表的草稿列、設計器預覽都以它輸入與顯示;
 * 已送出的修訂一律用那次修訂自己的 `ctx.timezone`(不拿讀者現在的時區補)。
 * 還沒載到為 null(呼叫端退回瀏覽器時區)。
 */
export const useTenantTimezone = (): string | null =>
  useMe().data?.me.currentOrg?.timezone ?? null;
