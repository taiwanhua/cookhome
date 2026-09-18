import { describe, expect, it } from "@jest/globals";
import { ConfigService } from "@nestjs/config";

import { loadPasswordConfig } from "./password.config";

function configWith(values: Record<string, string>): ConfigService {
  return new ConfigService(values);
}

describe("密碼流程設定(環境變數;登記於 docs/env-registry.md)", () => {
  it("都有內建預設值:ADMIN_APP_URL 本地 admin、啟用 7d、重設 30m(ADR-0009)", () => {
    expect(loadPasswordConfig(configWith({}))).toEqual({
      adminAppUrl: "http://localhost:3001",
      activationTokenTtlMs: 7 * 24 * 60 * 60 * 1000,
      passwordResetTokenTtlMs: 30 * 60 * 1000,
    });
  });

  it("可由環境變數調整;ADMIN_APP_URL 結尾斜線去掉(組連結時不會出現 //);格式不對即拋錯", () => {
    expect(
      loadPasswordConfig(
        configWith({
          ADMIN_APP_URL: "https://erp-dev.cookhome.online/",
          ACTIVATION_TOKEN_TTL: "3d",
          PASSWORD_RESET_TOKEN_TTL: "900",
        }),
      ),
    ).toEqual({
      adminAppUrl: "https://erp-dev.cookhome.online",
      activationTokenTtlMs: 3 * 24 * 60 * 60 * 1000,
      passwordResetTokenTtlMs: 900 * 1000,
    });

    expect(() =>
      loadPasswordConfig(configWith({ ACTIVATION_TOKEN_TTL: "a week" })),
    ).toThrow(/ACTIVATION_TOKEN_TTL/);
  });

  it("空字串視同未設定(YAML 留空鍵)", () => {
    expect(
      loadPasswordConfig(configWith({ ADMIN_APP_URL: "" })).adminAppUrl,
    ).toBe("http://localhost:3001");
  });
});
