import { describe, expect, it, jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";

import { MAIL_SENDER } from "./mail-templates";
import { loadMailConfig } from "./mail.config";
import { createMailService } from "./mail.module";
import { type ActionEmailInput, MailService } from "./mail.service";
import { RecordingMailService } from "./recording-mail.service";
import { type ResendClient, ResendMailService } from "./resend-mail.service";

function configWith(values: Record<string, string>): ConfigService {
  return new ConfigService(values);
}

const ACTIVATION: ActionEmailInput = {
  to: "New.User@example.com",
  name: "小明",
  link: "https://erp-dev.cookhome.online/set-password?token=abc123",
  expiresAt: new Date("2026-09-25T08:00:00Z"),
};

const RESET: ActionEmailInput = {
  to: "someone@example.com",
  name: "小華",
  link: "https://erp-dev.cookhome.online/set-password?token=reset-xyz",
  expiresAt: new Date("2026-09-18T08:30:00Z"),
};

interface SendResult {
  error: { message: string } | null;
}

/** 假 Resend client:記下呼叫、回指定結果,不打網路。 */
function fakeClient(result?: SendResult): {
  client: ResendClient;
  send: jest.Mock<ResendClient["emails"]["send"]>;
} {
  const response: SendResult = result ?? { error: null };
  const send = jest.fn<ResendClient["emails"]["send"]>(() =>
    Promise.resolve(response),
  );
  return { client: { emails: { send } }, send };
}

describe("寄信(ADR-0010:MailService 介面 + Resend adapter + 記錄用 adapter;收件白名單)", () => {
  describe("設定(環境變數;登記於 docs/env-registry.md)", () => {
    it("都有內建預設值:沒 RESEND_API_KEY、白名單空(= 不限)", () => {
      expect(loadMailConfig(configWith({}))).toEqual({
        resendApiKey: undefined,
        allowlist: [],
      });
    });

    it("MAIL_ALLOWLIST 逗號分隔、去空白、不分大小寫;空字串視同未設定", () => {
      expect(
        loadMailConfig(
          configWith({
            RESEND_API_KEY: "re_test",
            MAIL_ALLOWLIST: " Dev@Example.com ,, qa@example.com ",
          }),
        ),
      ).toEqual({
        resendApiKey: "re_test",
        allowlist: ["dev@example.com", "qa@example.com"],
      });
      expect(
        loadMailConfig(configWith({ RESEND_API_KEY: "", MAIL_ALLOWLIST: "" })),
      ).toEqual({ resendApiKey: undefined, allowlist: [] });
    });
  });

  describe("adapter 選擇(api 不因缺 key 而啟動失敗)", () => {
    it("RESEND_API_KEY 未設 → 記錄用 adapter;有設 → Resend adapter;兩者都是 MailService", () => {
      const recording = createMailService({
        resendApiKey: undefined,
        allowlist: [],
      });
      expect(recording).toBeInstanceOf(RecordingMailService);
      expect(recording).toBeInstanceOf(MailService);

      const resend = createMailService({
        resendApiKey: "re_test",
        allowlist: [],
      });
      expect(resend).toBeInstanceOf(ResendMailService);
      expect(resend).toBeInstanceOf(MailService);
    });
  });

  describe("記錄用 adapter(測試與本地用:記下每封信,從中讀出連結走下一步)", () => {
    it("啟用信 / 重設信:記下種類、收件人、連結、繁中主旨與內文(含稱呼與連結)", async () => {
      const mail = new RecordingMailService({
        resendApiKey: undefined,
        allowlist: [],
      });

      await mail.sendActivationEmail(ACTIVATION);
      await mail.sendPasswordResetEmail(RESET);

      expect(mail.sent).toHaveLength(2);
      const [activation, reset] = mail.sent;
      expect(activation).toMatchObject({
        kind: "activation",
        to: ACTIVATION.to,
        link: ACTIVATION.link,
      });
      expect(activation?.subject).toMatch(/啟用/);
      expect(activation?.text).toContain("小明");
      expect(activation?.text).toContain(ACTIVATION.link);
      expect(activation?.html).toContain(ACTIVATION.link);

      expect(reset).toMatchObject({
        kind: "password-reset",
        to: RESET.to,
        link: RESET.link,
      });
      expect(reset?.subject).toMatch(/重設密碼/);
      expect(reset?.text).toContain("小華");
      expect(reset?.text).toContain(RESET.link);
    });

    it("MAIL_ALLOWLIST 有值時白名單外不寄(不拋錯、不記入 sent);比對不分大小寫", async () => {
      const mail = new RecordingMailService({
        resendApiKey: undefined,
        allowlist: ["new.user@example.com"],
      });

      await mail.sendActivationEmail(ACTIVATION);
      await mail.sendPasswordResetEmail(RESET);

      expect(mail.sent.map((message) => message.to)).toEqual([ACTIVATION.to]);
    });
  });

  describe("Resend adapter(單元測試以假 client 取代網路)", () => {
    it("以固定寄件人 no-reply@cookhome.online 送出主旨 / 純文字 / HTML", async () => {
      const { client, send } = fakeClient();
      const mail = new ResendMailService(
        { resendApiKey: "re_test", allowlist: [] },
        client,
      );

      await mail.sendPasswordResetEmail(RESET);

      expect(send).toHaveBeenCalledTimes(1);
      const payload = send.mock.calls[0]?.[0];
      expect(payload).toMatchObject({
        from: MAIL_SENDER,
        to: RESET.to,
      });
      expect(MAIL_SENDER).toContain("no-reply@cookhome.online");
      expect(payload?.subject).toMatch(/重設密碼/);
      expect(payload?.text).toContain(RESET.link);
      expect(payload?.html).toContain(RESET.link);
    });

    it("白名單外不呼叫 Resend;Resend 回錯誤即拋錯(呼叫端決定要不要吞)", async () => {
      const blocked = fakeClient();
      const mail = new ResendMailService(
        { resendApiKey: "re_test", allowlist: ["dev@example.com"] },
        blocked.client,
      );
      await mail.sendActivationEmail(ACTIVATION);
      expect(blocked.send).not.toHaveBeenCalled();

      const failing = fakeClient({ error: { message: "domain not verified" } });
      const failingMail = new ResendMailService(
        { resendApiKey: "re_test", allowlist: [] },
        failing.client,
      );
      await expect(failingMail.sendActivationEmail(ACTIVATION)).rejects.toThrow(
        /domain not verified/,
      );
    });
  });
});
