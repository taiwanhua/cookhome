import { ConfigService } from "@nestjs/config";

import { parseDurationMs } from "./duration";

/** 注入 token(登入線的設定值,自環境變數讀取;登記:docs/env-registry.md)。 */
export const AUTH_CONFIG = Symbol("AUTH_CONFIG");

export interface AuthConfig {
  /** access token HS256 簽章密鑰(Secret Manager `JWT_SECRET`);缺少即啟動失敗。 */
  jwtSecret: string;
  /** access token 效期(`ACCESS_TOKEN_TTL`,預設 15m)。 */
  accessTokenTtlMs: number;
  /** refresh token 效期(`REFRESH_TOKEN_TTL`,預設 30d)。 */
  refreshTokenTtlMs: number;
  /** refresh cookie 的 Domain(`COOKIE_DOMAIN`,雲端 `.cookhome.online`);本地不設 → 不帶 Domain。 */
  cookieDomain: string | undefined;
}

export const DEFAULT_ACCESS_TOKEN_TTL = "15m";
export const DEFAULT_REFRESH_TOKEN_TTL = "30d";

/**
 * 每個變數都有內建預設值、不設也能跑 — 只有 `JWT_SECRET` 例外:
 * 沒有密鑰就簽不出可信的 token,寧可啟動失敗也不用預設密鑰(ADR-0003)。
 */
export function loadAuthConfig(config: ConfigService): AuthConfig {
  const jwtSecret = config.get<string>("JWT_SECRET");
  if (!jwtSecret) {
    throw new Error(
      "缺少 JWT_SECRET 環境變數(access token 簽章密鑰;雲端存 Secret Manager,本地見 .env.example)",
    );
  }
  return {
    jwtSecret,
    accessTokenTtlMs: parseDurationMs(
      config.get<string>("ACCESS_TOKEN_TTL") ?? DEFAULT_ACCESS_TOKEN_TTL,
      "ACCESS_TOKEN_TTL",
    ),
    refreshTokenTtlMs: parseDurationMs(
      config.get<string>("REFRESH_TOKEN_TTL") ?? DEFAULT_REFRESH_TOKEN_TTL,
      "REFRESH_TOKEN_TTL",
    ),
    cookieDomain: nonEmpty(config.get<string>("COOKIE_DOMAIN")),
  };
}

/** 空字串視同未設定(YAML 留空鍵時常見)。 */
function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

export const authConfigProvider = {
  provide: AUTH_CONFIG,
  inject: [ConfigService],
  useFactory: loadAuthConfig,
};
