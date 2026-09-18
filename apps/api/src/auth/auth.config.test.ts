import { describe, expect, it } from "@jest/globals";
import { ConfigService } from "@nestjs/config";

import { loadAuthConfig } from "./auth.config";

function configWith(values: Record<string, string>): ConfigService {
  return new ConfigService(values);
}

describe("登入線設定(環境變數;登記於 docs/env-registry.md)", () => {
  it("缺少 JWT_SECRET 即啟動失敗,錯誤訊息指出變數名", () => {
    expect(() => loadAuthConfig(configWith({}))).toThrow(/JWT_SECRET/);
  });

  it("其餘變數都有內建預設值:ACCESS_TOKEN_TTL 15m、REFRESH_TOKEN_TTL 30d、COOKIE_DOMAIN 不設", () => {
    const config = loadAuthConfig(configWith({ JWT_SECRET: "secret" }));
    expect(config).toEqual({
      jwtSecret: "secret",
      accessTokenTtlMs: 15 * 60 * 1000,
      refreshTokenTtlMs: 30 * 24 * 60 * 60 * 1000,
      cookieDomain: undefined,
    });
  });

  it("TTL 接受 ms / s / m / h / d 與純數字(秒);格式不對即拋錯而非退回預設", () => {
    const config = loadAuthConfig(
      configWith({
        JWT_SECRET: "secret",
        ACCESS_TOKEN_TTL: "90",
        REFRESH_TOKEN_TTL: "12h",
        COOKIE_DOMAIN: ".cookhome.online",
      }),
    );
    expect(config.accessTokenTtlMs).toBe(90 * 1000);
    expect(config.refreshTokenTtlMs).toBe(12 * 60 * 60 * 1000);
    expect(config.cookieDomain).toBe(".cookhome.online");

    expect(() =>
      loadAuthConfig(
        configWith({ JWT_SECRET: "secret", ACCESS_TOKEN_TTL: "fifteen" }),
      ),
    ).toThrow(/ACCESS_TOKEN_TTL/);
  });

  it("COOKIE_DOMAIN 空字串視同未設定(YAML 留空鍵)", () => {
    const config = loadAuthConfig(
      configWith({ JWT_SECRET: "secret", COOKIE_DOMAIN: "" }),
    );
    expect(config.cookieDomain).toBeUndefined();
  });
});
