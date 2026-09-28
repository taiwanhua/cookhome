import { describe, expect, it } from "@jest/globals";

import { COLOR_MODE_STORAGE_KEY, COLOR_SCHEME_STORAGE_KEY } from "./color-mode";
import { colorModeInitScript, colorModeInitTag } from "./color-mode-init";

describe("首幀外觀腳本", () => {
  it("用和 useColorMode 相同的 storage key,依模式與系統偏好決定 class", () => {
    const script = colorModeInitScript();
    expect(script).toContain(`"${COLOR_MODE_STORAGE_KEY}"`);
    expect(script).toContain(`"${COLOR_SCHEME_STORAGE_KEY}-light"`);
    expect(script).toContain(`"${COLOR_SCHEME_STORAGE_KEY}-dark"`);
    expect(script).toContain("prefers-color-scheme: dark");
    expect(script).toContain("document.documentElement.classList.add");
  });

  it("注入 head 的 script 標籤", () => {
    const tag = colorModeInitTag();
    expect(tag.tag).toBe("script");
    expect(tag.injectTo).toBe("head");
    expect(tag.children).toContain(COLOR_MODE_STORAGE_KEY);
  });
});
