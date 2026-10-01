import { describe, expect, it } from "@jest/globals";

import { formatMailSender } from "./mail-sender";

const EMAIL = "no-reply@example.com";

/** 期望值逐筆手寫(RFC 5322 的 name-addr),不經受測函式推導。 */
describe("formatMailSender:寄件人 `顯示名 <信箱>`", () => {
  it.each([
    ["CookHome", "CookHome <no-reply@example.com>"],
    ["Acme Portal", "Acme Portal <no-reply@example.com>"],
    ["廚房之家", "廚房之家 <no-reply@example.com>"],
    ["O'Neil Kitchen", "O'Neil Kitchen <no-reply@example.com>"],
    ["A&B {Lab}", "A&B {Lab} <no-reply@example.com>"],
  ])("不含 RFC 特殊符號的顯示名 %p 原樣保留", (name, expected) => {
    expect(formatMailSender(name, EMAIL)).toBe(expected);
  });

  it.each([
    ["Acme, Inc", '"Acme, Inc" <no-reply@example.com>'],
    ["Nova <Lab>", '"Nova <Lab>" <no-reply@example.com>'],
    ["Nova {Lab} <O'Neil>", `"Nova {Lab} <O'Neil>" <no-reply@example.com>`],
    ['Say "Hi"', String.raw`"Say \"Hi\"" <no-reply@example.com>`],
    [String.raw`Back\slash`, String.raw`"Back\\slash" <no-reply@example.com>`],
    ["Acme Inc.", '"Acme Inc." <no-reply@example.com>'],
    ["ops@acme", '"ops@acme" <no-reply@example.com>'],
    ["Team: A; B", '"Team: A; B" <no-reply@example.com>'],
    ["廚房 (台北)", '"廚房 (台北)" <no-reply@example.com>'],
    ["Box [1]", '"Box [1]" <no-reply@example.com>'],
  ])(
    "含 RFC 特殊符號的顯示名 %p 以 quoted-string 表示,只跳脫雙引號與反斜線",
    (name, expected) => {
      expect(formatMailSender(name, EMAIL)).toBe(expected);
    },
  );

  it("寄件信箱只出現一次,且在最後的角括號裡", () => {
    const sender = formatMailSender("Evil <attacker@evil.example>", EMAIL);

    expect(sender).toBe(
      '"Evil <attacker@evil.example>" <no-reply@example.com>',
    );
  });

  it.each([
    ["CR", "Acme\rBcc: x@evil.example"],
    ["LF", "Acme\nBcc: x@evil.example"],
    ["CRLF", "Acme\r\nBcc: x@evil.example"],
    ["NUL", "Acme\u0000"],
    ["TAB", "Acme\tPortal"],
    ["DEL", "Acme\u007F"],
    ["C1 控制字元", "Acme\u0085Portal"],
  ])("顯示名含 %s 時拒絕,不帶進 header", (_label, name) => {
    expect(() => formatMailSender(name, EMAIL)).toThrow(/控制字元/);
  });
});
