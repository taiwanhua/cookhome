import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { projectMail } from "@repo/project-config/mail";

import type {
  ActionEmailInput,
  MailMessage,
  WorkflowResultEmailInput,
  WorkflowTaskEmailInput,
} from "./mail.service";
import type { ResendClient, ResendEmailPayload } from "./resend-mail.service";

/**
 * 信件的品牌文字與寄件人來自專案設定(`@repo/project-config/mail`)。三組測試各管一件事:
 * 1. **固定的 CookHome 夾具**:四類信件的完整輸出以快照固定 —— 快照是抽設定**之前**的程式產生的,
 *    之後必須逐字相同。夾具寫死在本檔,不讀目前的專案設定,換專案不必改。
 * 2. **替代品牌夾具**:四類信件與 Resend 的 `from` 都跟著換,且不殘留別的品牌。
 * 3. **目前的專案設定**:正式模組(不替換設定)組出的寄件人、主旨、署名與 `from` 用的就是目前的設定值。
 */

interface MailProject {
  brandName: string;
  senderEmail: string;
  signature: string;
}

const COOKHOME: MailProject = {
  brandName: "CookHome",
  senderEmail: "no-reply@cookhome.online",
  signature: "CookHome 後台管理系統",
};

const ALTERNATIVE: MailProject = {
  brandName: "Acme Portal",
  senderEmail: "no-reply@acme.example",
  signature: "Acme Portal 管理後台",
};

const ACTION: ActionEmailInput = {
  to: "ming@example.com",
  name: "小明",
  link: "https://admin.example.com/set-password?token=abc&next=%2F",
  expiresAt: new Date("2026-09-25T08:00:00Z"),
};

const TASK: WorkflowTaskEmailInput = {
  to: "reviewer@example.com",
  name: "審核者",
  formName: "請假單",
  title: "九月特休",
  stepName: "主管核准",
  link: "https://admin.example.com/requests/1",
};

const RESULT: WorkflowResultEmailInput = {
  to: "ming@example.com",
  name: "小明",
  formName: "請假單",
  title: null,
  result: "rejected",
  comment: "日期重疊",
  link: "https://admin.example.com/requests/1",
};

/** 內容帶 HTML 特殊字元:跳脫規則是輸出的一部分,一起固定。 */
const HOSTILE: WorkflowResultEmailInput = {
  ...RESULT,
  name: `<b>O'Brien</b>`,
  title: `"A&B" <script>`,
  result: "returned",
  comment: "<img src=x onerror=alert(1)>",
};

interface MailModules {
  templates: typeof import("./mail-templates");
  resend: typeof import("./resend-mail.service");
}

/**
 * 載入一份全新的信件模組(模板的品牌常數在模組載入時讀設定)。
 * 給 `project` 就以它頂替專案設定;不給則用正式的 `@repo/project-config/mail`。
 */
const withMailModules = async <T>(
  project: MailProject | null,
  run: (modules: MailModules) => Promise<T> | T,
): Promise<T> => {
  let result: T | undefined;
  await jest.isolateModulesAsync(async () => {
    if (project !== null) {
      jest.doMock("@repo/project-config/mail", () => ({
        projectMail: project,
      }));
    }
    const templates = await import("./mail-templates");
    const resend = await import("./resend-mail.service");
    result = await run({ templates, resend });
  });
  return result as T;
};

/** 假 Resend client:記下送出的 payload,不打網路。 */
const fakeResend = (): { client: ResendClient; sent: ResendEmailPayload[] } => {
  const sent: ResendEmailPayload[] = [];
  return {
    sent,
    client: {
      emails: {
        send: (payload) => {
          sent.push(payload);
          return Promise.resolve({ error: null });
        },
      },
    },
  };
};

/** 四類信件各寄一封,回傳假 client 收到的 payload。 */
const sendFourKinds = async (
  project: MailProject | null,
): Promise<ResendEmailPayload[]> => {
  const { client, sent } = fakeResend();
  await withMailModules(project, async ({ resend }) => {
    const mail = new resend.ResendMailService(
      { resendApiKey: "re_test", allowlist: [] },
      client,
    );
    await mail.sendActivationEmail(ACTION);
    await mail.sendPasswordResetEmail(ACTION);
    await mail.sendWorkflowTaskEmail(TASK);
    await mail.sendWorkflowResultEmail(RESULT);
  });
  return sent;
};

const buildFourKinds = (templates: MailModules["templates"]): MailMessage[] => [
  templates.buildActivationEmail(ACTION),
  templates.buildPasswordResetEmail(ACTION),
  templates.buildWorkflowTaskEmail(TASK),
  templates.buildWorkflowResultEmail(RESULT),
];

afterEach(() => {
  jest.dontMock("@repo/project-config/mail");
});

/** 以固定的 CookHome 設定載入模板。 */
const withCookhome = <T>(
  run: (templates: MailModules["templates"]) => T,
): Promise<T> => withMailModules(COOKHOME, ({ templates }) => run(templates));

describe("固定的 CookHome 設定:信件輸出與抽設定前逐字相同", () => {
  it("寄件人", async () => {
    expect(await withCookhome((templates) => templates.MAIL_SENDER)).toBe(
      "CookHome <no-reply@cookhome.online>",
    );
  });

  it("啟用信", async () => {
    expect(
      await withCookhome((templates) => templates.buildActivationEmail(ACTION)),
    ).toMatchSnapshot();
  });

  it("重設密碼信", async () => {
    expect(
      await withCookhome((templates) =>
        templates.buildPasswordResetEmail(ACTION),
      ),
    ).toMatchSnapshot();
  });

  it("審核任務通知", async () => {
    const [titled, untitled] = await withCookhome((templates) => [
      templates.buildWorkflowTaskEmail(TASK),
      templates.buildWorkflowTaskEmail({ ...TASK, title: null }),
    ]);
    expect(titled).toMatchSnapshot();
    expect(untitled).toMatchSnapshot();
  });

  it("審核結果通知(核准 / 駁回附理由 / 退回)", async () => {
    const [approved, rejected, returned] = await withCookhome((templates) => [
      templates.buildWorkflowResultEmail({
        ...RESULT,
        result: "approved",
        comment: null,
      }),
      templates.buildWorkflowResultEmail(RESULT),
      templates.buildWorkflowResultEmail({ ...RESULT, result: "returned" }),
    ]);
    expect(approved).toMatchSnapshot();
    expect(rejected).toMatchSnapshot();
    expect(returned).toMatchSnapshot();
  });

  it("HTML 跳脫:使用者輸入的特殊字元不會變成標籤", async () => {
    expect(
      await withCookhome((templates) =>
        templates.buildWorkflowResultEmail(HOSTILE),
      ),
    ).toMatchSnapshot();
  });

  it("Resend 實際送出的 from 就是原寄件人", async () => {
    const sent = await sendFourKinds(COOKHOME);

    expect(sent.map((payload) => payload.from)).toEqual([
      "CookHome <no-reply@cookhome.online>",
      "CookHome <no-reply@cookhome.online>",
      "CookHome <no-reply@cookhome.online>",
      "CookHome <no-reply@cookhome.online>",
    ]);
  });
});

describe("替代專案設定:信件品牌與寄件人跟著換", () => {
  it("寄件人由品牌名與寄件信箱組成", async () => {
    const sender = await withMailModules(
      ALTERNATIVE,
      ({ templates }) => templates.MAIL_SENDER,
    );

    expect(sender).toBe("Acme Portal <no-reply@acme.example>");
  });

  it("四類信件:主旨前綴、內文品牌與署名都是替代品牌,不殘留原品牌", async () => {
    const messages = await withMailModules(ALTERNATIVE, ({ templates }) =>
      buildFourKinds(templates),
    );

    expect(messages.map((message) => message.subject)).toEqual([
      "【Acme Portal】啟用您的後台帳號",
      "【Acme Portal】重設密碼",
      "【Acme Portal】待審核:請假單:九月特休",
      "【Acme Portal】申請已駁回:請假單",
    ]);
    expect(messages[0]?.text).toContain("您的 Acme Portal 後台帳號已建立。");
    for (const message of messages) {
      expect(message.text.endsWith("\n\nAcme Portal 管理後台")).toBe(true);
      expect(message.html).toContain("<p>Acme Portal 管理後台</p>");
      expect(
        `${message.subject}\n${message.text}\n${message.html}`,
      ).not.toMatch(/cookhome/i);
    }
  });

  it("Resend 實際送出的 from 是替代寄件人(四類信件皆然)", async () => {
    const sent = await sendFourKinds(ALTERNATIVE);

    expect(sent.map((payload) => payload.from)).toEqual([
      "Acme Portal <no-reply@acme.example>",
      "Acme Portal <no-reply@acme.example>",
      "Acme Portal <no-reply@acme.example>",
      "Acme Portal <no-reply@acme.example>",
    ]);
    expect(sent.map((payload) => payload.subject)).toEqual([
      "【Acme Portal】啟用您的後台帳號",
      "【Acme Portal】重設密碼",
      "【Acme Portal】待審核:請假單:九月特休",
      "【Acme Portal】申請已駁回:請假單",
    ]);
  });

  it("品牌名與署名帶 HTML 特殊字元時,HTML 內文照樣跳脫", async () => {
    const message = await withMailModules(
      {
        brandName: "A&B <Co>",
        senderEmail: "no-reply@ab.example",
        signature: `A&B <Co> "後台"`,
      },
      ({ templates }) => templates.buildActivationEmail(ACTION),
    );

    expect(message.subject).toBe("【A&B <Co>】啟用您的後台帳號");
    expect(message.text).toContain("您的 A&B <Co> 後台帳號已建立。");
    expect(message.html).toContain(
      "<p>您的 A&amp;B &lt;Co&gt; 後台帳號已建立。",
    );
    expect(message.html).toContain(
      "<p>A&amp;B &lt;Co&gt; &quot;後台&quot;</p>",
    );
    expect(message.html).not.toContain("<Co>");
  });
});

/**
 * 不替換設定:正式模組讀到的就是目前的專案值。期望值由設定值與**本檔自己寫的格式**組出,
 * 不呼叫受測的模板函式來推導,也不寫任何專案的字面值。
 */
describe("目前的專案設定:正式接線", () => {
  const expectedSender = `${projectMail.brandName} <${projectMail.senderEmail}>`;
  const subjectPrefix = `【${projectMail.brandName}】`;

  it("寄件人 = `<品牌名> <寄件信箱>`", async () => {
    const sender = await withMailModules(
      null,
      ({ templates }) => templates.MAIL_SENDER,
    );

    expect(sender).toBe(expectedSender);
  });

  it("四類信件的主旨前綴是品牌名,純文字與 HTML 都以署名結尾", async () => {
    const messages = await withMailModules(null, ({ templates }) =>
      buildFourKinds(templates),
    );

    expect(messages.map((message) => message.kind)).toEqual([
      "activation",
      "password-reset",
      "workflow-task",
      "workflow-result",
    ]);
    for (const message of messages) {
      expect(message.subject.startsWith(subjectPrefix)).toBe(true);
      expect(message.text.endsWith(`\n\n${projectMail.signature}`)).toBe(true);
      expect(message.text).toContain(message.link);
    }
    expect(messages[0]?.text).toContain(
      `您的 ${projectMail.brandName} 後台帳號已建立。`,
    );
  });

  it("Resend 實際送出的 from 是目前設定的寄件人(四類信件皆然)", async () => {
    const sent = await sendFourKinds(null);

    expect(sent.map((payload) => payload.from)).toEqual([
      expectedSender,
      expectedSender,
      expectedSender,
      expectedSender,
    ]);
    for (const payload of sent) {
      expect(payload.subject.startsWith(subjectPrefix)).toBe(true);
    }
  });
});
