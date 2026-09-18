const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const DURATION_PATTERN = /^(\d+)\s*(ms|s|m|h|d)?$/;

/**
 * 解析效期字串為毫秒:`15m`、`30d`、`12h`、`45s`、`500ms`;純數字視為秒(與 JWT `exp` 慣例一致)。
 * 格式不對即拋錯 — 設定錯誤要在啟動時暴露,不要靜默退回預設。
 */
export function parseDurationMs(value: string, name: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(
      `${name} 格式不正確:「${value}」(可用 15m / 30d / 12h / 45s,純數字視為秒)`,
    );
  }
  const amount = Number(match[1]);
  const unit = match[2] ?? "s";
  return amount * (UNIT_MS[unit] ?? 1000);
}
