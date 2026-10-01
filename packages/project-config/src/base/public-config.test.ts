import { describe, expect, it } from "@jest/globals";

import {
  type ProjectPublicConfig,
  assertProjectPublicConfig,
} from "./public-config";

/** 替代品牌夾具:每個欄位都與 CookHome 不同,驗證檢查器不認特定專案。 */
const ALTERNATIVE: ProjectPublicConfig = {
  slug: "acme-portal",
  brand: { name: "Acme Portal", primary: "#2065D1" },
  admin: { documentTitle: "Acme <Admin> & Co" },
  front: {
    metadata: {
      "zh-TW": {
        title: "Acme — 入口",
        titleTemplate: "%s | Acme",
        description: "Acme 的網站",
      },
      en: {
        title: "Acme — Portal",
        titleTemplate: "%s | Acme",
        description: "The Acme site",
      },
    },
  },
  compatibility: { legacySideNavStorageKey: null },
};

/** 以不合型別的輸入模擬「專案值被改壞」;檢查器在執行期把關,所以夾具的型別刻意放寬。 */
const broken = (patch: Record<string, unknown>): ProjectPublicConfig =>
  Object.assign({}, ALTERNATIVE, patch);

describe("公開設定的驗證(不默默補回任何專案的值)", () => {
  it("合法設定原樣回傳,不改寫內容", () => {
    expect(assertProjectPublicConfig(ALTERNATIVE)).toBe(ALTERNATIVE);
  });

  it.each(["", "Acme", "acme_portal", "acme portal", "-acme", "acme-", "a--b"])(
    "slug %p 不是小寫 kebab-case → 拒絕",
    (slug) => {
      expect(() => assertProjectPublicConfig(broken({ slug }))).toThrow(/slug/);
    },
  );

  it.each(["FB7B10", "#FB7B1", "#FB7B10FF", "#GGGGGG", "orange", ""])(
    "primary %p 不是 # 加六位十六進位 → 拒絕",
    (primary) => {
      expect(() =>
        assertProjectPublicConfig(broken({ brand: { name: "Acme", primary } })),
      ).toThrow(/brand\.primary/);
    },
  );

  it("缺少必要值時指出是哪一個欄位", () => {
    expect(() =>
      assertProjectPublicConfig(
        broken({ brand: { name: " ", primary: "#2065D1" } }),
      ),
    ).toThrow(/brand\.name/);
    expect(() =>
      assertProjectPublicConfig(broken({ admin: { documentTitle: "" } })),
    ).toThrow(/admin\.documentTitle/);
    expect(() =>
      assertProjectPublicConfig(broken({ slug: undefined })),
    ).toThrow(/slug/);
    expect(() =>
      assertProjectPublicConfig(broken({ front: { metadata: {} } })),
    ).toThrow(/front\.metadata/);
    expect(() =>
      assertProjectPublicConfig(
        broken({
          front: {
            metadata: {
              "zh-TW": { title: "Acme", titleTemplate: "%s | Acme" },
            },
          },
        }),
      ),
    ).toThrow(/front\.metadata\.zh-TW\.description/);
  });

  it("titleTemplate 必須保留 `%s` 佔位(Next 的 title template 語意)", () => {
    expect(() =>
      assertProjectPublicConfig(
        broken({
          front: {
            metadata: {
              en: { title: "Acme", titleTemplate: "Acme", description: "x" },
            },
          },
        }),
      ),
    ).toThrow(/front\.metadata\.en\.titleTemplate/);
  });

  it("legacySideNavStorageKey 只接受 null 或非空字串", () => {
    expect(() =>
      assertProjectPublicConfig(
        broken({ compatibility: { legacySideNavStorageKey: "" } }),
      ),
    ).toThrow(/compatibility\.legacySideNavStorageKey/);
    expect(() =>
      assertProjectPublicConfig(broken({ compatibility: {} })),
    ).toThrow(/compatibility\.legacySideNavStorageKey/);
  });
});
