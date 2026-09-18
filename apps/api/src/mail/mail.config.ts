import { ConfigService } from "@nestjs/config";

/** 注入 token(寄信的設定值,自環境變數讀取;登記:docs/env-registry.md)。 */
export const MAIL_CONFIG = Symbol("MAIL_CONFIG");

export interface MailConfig {
  /**
   * Resend API key(Secret Manager `RESEND_API_KEY`)。
   * 未設 → 自動改用記錄用 adapter(信件只印到 stdout),api 不因缺 key 而啟動失敗。
   */
  resendApiKey: string | undefined;
  /**
   * 收件白名單(`MAIL_ALLOWLIST`,逗號分隔;ADR-0010):有值時只寄給名單內的信箱,空 = 不限。
   * 已正規化為小寫、去空白。
   */
  allowlist: string[];
}

export function loadMailConfig(config: ConfigService): MailConfig {
  return {
    resendApiKey: nonEmpty(config.get<string>("RESEND_API_KEY")),
    allowlist: parseAllowlist(config.get<string>("MAIL_ALLOWLIST")),
  };
}

/** 空字串視同未設定(YAML 留空鍵時常見)。 */
function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

function parseAllowlist(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "");
}

export const mailConfigProvider = {
  provide: MAIL_CONFIG,
  inject: [ConfigService],
  useFactory: loadMailConfig,
};
