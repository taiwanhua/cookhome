import { Logger, Module } from "@nestjs/common";

import {
  MAIL_CONFIG,
  type MailConfig,
  mailConfigProvider,
} from "./mail.config";
import { MailService } from "./mail.service";
import { RecordingMailService } from "./recording-mail.service";
import { ResendMailService } from "./resend-mail.service";

/**
 * 依設定選 adapter:有 RESEND_API_KEY → Resend;沒有 → 記錄用 adapter(印到 stdout)。
 * 缺 key 不讓 api 啟動失敗 — 本地與測試本來就不該真寄信;雲端漏設會在 log 看到警告。
 */
export function createMailService(config: MailConfig): MailService {
  if (config.resendApiKey) {
    return new ResendMailService(config);
  }
  new Logger(MailModule.name).warn(
    "RESEND_API_KEY 未設定,改用記錄用 adapter:信件只印到 stdout、不會真的寄出",
  );
  return new RecordingMailService(config);
}

/** 寄信(ADR-0010)。呼叫端只注入 `MailService`,不認得供應商。 */
@Module({
  providers: [
    mailConfigProvider,
    {
      provide: MailService,
      inject: [MAIL_CONFIG],
      useFactory: createMailService,
    },
  ],
  exports: [MailService],
})
export class MailModule {}
