import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";

import {
  COLOR_MODE_STORAGE_KEY,
  COLOR_SCHEME_STORAGE_KEY,
} from "../lib/color-mode";

/**
 * 首幀外觀腳本寫在 html 裡(React 插入的內嵌 script 不會執行),key 只能手抄;
 * 這裡守住它和 `color-mode.ts` 的常數一致,兩個 html 入口都要有。
 */
describe("首幀外觀腳本(index.html / mock.html)", () => {
  const htmlOf = (name: string) =>
    readFileSync(join(process.cwd(), name), "utf8");

  it.each(["index.html", "mock.html"])(
    "%s 的首幀腳本用和 color-mode.ts 相同的 storage key,並依系統偏好決定暗色",
    (name) => {
      const html = htmlOf(name);
      expect(html).toContain(`"${COLOR_MODE_STORAGE_KEY}"`);
      expect(html).toContain(`"${COLOR_SCHEME_STORAGE_KEY}"`);
      expect(html).toContain("prefers-color-scheme: dark");
      expect(html).toContain("document.documentElement.classList.add");
    },
  );
});
