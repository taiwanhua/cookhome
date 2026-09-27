import type {
  ActionEmailInput,
  MailMessage,
  WorkflowResultEmailInput,
  WorkflowTaskEmailInput,
} from "./mail.service";

/*
 * 信件模板(文案繁中)。品牌文字 / 寄件人屬品牌元素,登記於 docs/branding.md(換品牌時逐列改)。
 */

/** 寄件人(ADR-0010:`no-reply@cookhome.online`;DNS SPF / DKIM 由使用者在 Resend 完成驗證)。 */
export const MAIL_SENDER = "CookHome <no-reply@cookhome.online>";

const BRAND_NAME = "CookHome";
const SIGNATURE = "CookHome 後台管理系統";

/** 到期時間以台灣時區顯示(收件人是後台使用者,皆在台灣)。 */
const EXPIRY_FORMAT = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function buildActivationEmail(input: ActionEmailInput): MailMessage {
  const expiry = EXPIRY_FORMAT.format(input.expiresAt);
  const paragraphs = [
    `${input.name} 您好:`,
    `您的 ${BRAND_NAME} 後台帳號已建立。請在 ${expiry} 前開啟以下連結設定密碼,完成啟用:`,
    input.link,
    "此連結只能使用一次;若已逾期,請在登入頁點「忘記密碼」重新取得連結。",
    "若您沒有申請這個帳號,請忽略此信。",
    SIGNATURE,
  ];
  return {
    kind: "activation",
    to: input.to,
    link: input.link,
    subject: `【${BRAND_NAME}】啟用您的後台帳號`,
    text: paragraphs.join("\n\n"),
    html: toHtml(paragraphs, input.link),
  };
}

export function buildPasswordResetEmail(input: ActionEmailInput): MailMessage {
  const expiry = EXPIRY_FORMAT.format(input.expiresAt);
  const paragraphs = [
    `${input.name} 您好:`,
    `我們收到您重設密碼的申請。請在 ${expiry} 前開啟以下連結設定新密碼:`,
    input.link,
    "此連結只能使用一次;若已逾期,請在登入頁重新申請。",
    "若這不是您本人的操作,請忽略此信,您的密碼不會改變。",
    SIGNATURE,
  ];
  return {
    kind: "password-reset",
    to: input.to,
    link: input.link,
    subject: `【${BRAND_NAME}】重設密碼`,
    text: paragraphs.join("\n\n"),
    html: toHtml(paragraphs, input.link),
  };
}

/** 審核任務通知(Spec 6b §7「通知信」):有新的審核任務,給審核者。內容只讀實例快照。 */
export function buildWorkflowTaskEmail(
  input: WorkflowTaskEmailInput,
): MailMessage {
  const subject = input.title
    ? `${input.formName}:${input.title}`
    : input.formName;
  const paragraphs = [
    `${input.name} 您好:`,
    `您有一筆待審核的申請:「${subject}」(關卡:${input.stepName})。請開啟以下連結查看並審核:`,
    input.link,
    SIGNATURE,
  ];
  return {
    kind: "workflow-task",
    to: input.to,
    link: input.link,
    subject: `【${BRAND_NAME}】待審核:${subject}`,
    text: paragraphs.join("\n\n"),
    html: toHtml(paragraphs, input.link),
  };
}

const RESULT_LABELS: Readonly<
  Record<WorkflowResultEmailInput["result"], string>
> = {
  approved: "已核准",
  rejected: "已駁回",
  returned: "已退回修改",
};

/** 審核結果通知(核准 / 駁回 / 退回),給申請人;駁回 / 退回附理由。 */
export function buildWorkflowResultEmail(
  input: WorkflowResultEmailInput,
): MailMessage {
  const subject = input.title
    ? `${input.formName}:${input.title}`
    : input.formName;
  const label = RESULT_LABELS[input.result];
  const paragraphs = [
    `${input.name} 您好:`,
    `您的申請「${subject}」${label}。`,
    ...(input.comment ? [`理由:${input.comment}`] : []),
    "請開啟以下連結查看詳情:",
    input.link,
    SIGNATURE,
  ];
  return {
    kind: "workflow-result",
    to: input.to,
    link: input.link,
    subject: `【${BRAND_NAME}】申請${label}:${subject}`,
    text: paragraphs.join("\n\n"),
    html: toHtml(paragraphs, input.link),
  };
}

/** 純文字段落轉最簡 HTML:連結那一段做成可點的 <a>,其餘逐段 <p>;內容一律跳脫。 */
function toHtml(paragraphs: string[], link: string): string {
  const body = paragraphs
    .map((paragraph) =>
      paragraph === link
        ? `<p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`
        : `<p>${escapeHtml(paragraph)}</p>`,
    )
    .join("\n");
  return `<!doctype html><html lang="zh-Hant"><body>\n${body}\n</body></html>`;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replaceAll(/["&'<>]/g, (char) => HTML_ESCAPES[char] ?? char);
}
