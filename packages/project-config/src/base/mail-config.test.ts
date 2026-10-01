import { describe, expect, it } from "@jest/globals";

import { type ProjectMailConfig, assertProjectMailConfig } from "./mail-config";

const ALTERNATIVE: ProjectMailConfig = {
  brandName: "Acme Portal",
  senderEmail: "no-reply@acme.example",
  signature: "Acme Portal 管理後台",
};

describe("信件設定的驗證", () => {
  it("合法設定原樣回傳", () => {
    expect(assertProjectMailConfig(ALTERNATIVE)).toBe(ALTERNATIVE);
  });

  it.each(["", "no-reply", "no-reply@", "Acme <no-reply@acme.example>"])(
    "senderEmail %p 不是單純的信箱 → 拒絕",
    (senderEmail) => {
      expect(() =>
        assertProjectMailConfig({ ...ALTERNATIVE, senderEmail }),
      ).toThrow(/senderEmail/);
    },
  );

  it("品牌名與署名不可空白", () => {
    expect(() =>
      assertProjectMailConfig({ ...ALTERNATIVE, brandName: "" }),
    ).toThrow(/brandName/);
    expect(() =>
      assertProjectMailConfig({ ...ALTERNATIVE, signature: " " }),
    ).toThrow(/signature/);
  });
});
