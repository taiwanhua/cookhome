import {
  DEFAULT_TENANT_TIMEZONE,
  type TemporalType,
  formatTemporal,
} from "@repo/domain/form";

import { useTenantTimezone } from "./useTenantTimezone";

/**
 * 日期 / 日期時間的顯示文字(admin 唯一入口;元件不自己格式化日期值):
 * 回 `(value, type) => formatTemporal(value, { type, timezone })` —— `date` 印 `YYYY-MM-DD`、
 * `datetime` 印 `YYYY-MM-DD HH:mm`,`value` 收 ISO 字串(或 `Date`)。
 *
 * 時區:呼叫端給了就用它(唯讀檢視 = 那次修訂的 `ctx.timezone`;列表這種每列不同的,呼叫時帶第三個參數),
 * 否則用讀者的租戶時區(`me.currentOrg.timezone`),還沒載到用預設的 `Asia/Taipei`;不用瀏覽器時區。
 */
export const useTemporalText = (
  timezone?: string | null,
): ((value: unknown, type: TemporalType, rowTimezone?: string) => string) => {
  const tenantTimezone = useTenantTimezone();
  const zone = timezone ?? tenantTimezone ?? DEFAULT_TENANT_TIMEZONE;
  return (value, type, rowTimezone) =>
    formatTemporal(value, { type, timezone: rowTimezone ?? zone });
};
