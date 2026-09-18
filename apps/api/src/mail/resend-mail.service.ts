import { Resend } from "resend";

import { MAIL_SENDER } from "./mail-templates";
import type { MailConfig } from "./mail.config";
import { type MailMessage, MailService } from "./mail.service";

export interface ResendEmailPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** 只取 Resend SDK 用到的那一角,單元測試以假 client 取代(不打真網路)。 */
export interface ResendClient {
  emails: {
    send(
      payload: ResendEmailPayload,
    ): Promise<{ error: { message: string } | null }>;
  };
}

/** Resend adapter(ADR-0010):寄件人固定 `MAIL_SENDER`;Resend 回錯誤即拋錯,由呼叫端決定處置。 */
export class ResendMailService extends MailService {
  private readonly client: ResendClient;

  constructor(config: MailConfig, client?: ResendClient) {
    super(config);
    this.client = client ?? new Resend(config.resendApiKey);
  }

  protected override async deliver(message: MailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: MAIL_SENDER,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    if (error) {
      throw new Error(
        `Resend 寄信失敗(${message.kind} → ${message.to}):${error.message}`,
      );
    }
  }
}
