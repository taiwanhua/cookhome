import { Logger } from "@nestjs/common";

import {
  buildActivationEmail,
  buildPasswordResetEmail,
} from "./mail-templates";
import type { MailConfig } from "./mail.config";

export type MailKind = "activation" | "password-reset";

/** 啟用信 / 重設信共用的輸入:收件人、稱呼、「設定新密碼」頁連結(含 token)、連結到期時間。 */
export interface ActionEmailInput {
  to: string;
  name: string;
  link: string;
  expiresAt: Date;
}

/** 模板產出、交給 adapter 投遞的一封信。 */
export interface MailMessage {
  kind: MailKind;
  to: string;
  link: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * 寄信介面(ADR-0010):呼叫端只認 `sendActivationEmail` / `sendPasswordResetEmail`;
 * 模板與收件白名單在此共用,供應商只是 `deliver` 的 adapter(Resend 是第一個;測試 / 本地用記錄用 adapter)。
 * 亦為 Nest 的注入 token(MailModule 依 RESEND_API_KEY 有無決定實作)。
 */
export abstract class MailService {
  /** 以實際 adapter 的類別名為 log 前綴(RecordingMailService / ResendMailService)。 */
  protected readonly logger: Logger;

  constructor(protected readonly config: MailConfig) {
    this.logger = new Logger(new.target.name);
  }

  sendActivationEmail(input: ActionEmailInput): Promise<void> {
    return this.send(buildActivationEmail(input));
  }

  sendPasswordResetEmail(input: ActionEmailInput): Promise<void> {
    return this.send(buildPasswordResetEmail(input));
  }

  /** 實際投遞一封信;失敗即拋錯。 */
  protected abstract deliver(message: MailMessage): Promise<void>;

  /** 白名單有值時只寄名單內(dev / staging 防誤寄真人);名單外靜默略過、不視為錯誤。 */
  private async send(message: MailMessage): Promise<void> {
    if (!isRecipientAllowed(this.config.allowlist, message.to)) {
      this.logger.warn(
        `收件人 ${message.to} 不在 MAIL_ALLOWLIST 內,略過 ${message.kind} 信`,
      );
      return;
    }
    await this.deliver(message);
  }
}

export function isRecipientAllowed(allowlist: string[], to: string): boolean {
  return allowlist.length === 0 || allowlist.includes(to.trim().toLowerCase());
}
