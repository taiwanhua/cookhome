import { describe, expect, it } from "@jest/globals";

import { createBrandFromPrimary, createPalette, mixHex } from "./brand";
import { createAppTheme } from "./create-theme";
import { statusPalettes } from "./tokens";

const HEX = /^#[0-9A-F]{6}$/;

const luma = (hex: string): number =>
  Number.parseInt(hex.slice(1, 3), 16) +
  Number.parseInt(hex.slice(3, 5), 16) +
  Number.parseInt(hex.slice(5, 7), 16);

describe("brand palette", () => {
  it("以 0 權重混色維持原色(OKLab round-trip 無失真)", () => {
    expect(mixHex("#FB7B10", "#FFFFFF", 0)).toBe("#FB7B10");
  });

  it("五階全為合法 hex,且明度單調(lighter 最亮、darker 最暗)", () => {
    const p = createPalette("#FB7B10");
    for (const value of Object.values(p)) {
      expect(value).toMatch(HEX);
    }
    expect(luma(p.lighter)).toBeGreaterThan(luma(p.light));
    expect(luma(p.light)).toBeGreaterThan(luma(p.main));
    expect(luma(p.main)).toBeGreaterThan(luma(p.dark));
    expect(luma(p.dark)).toBeGreaterThan(luma(p.darker));
  });

  it("overrides 逃生口可逐階覆寫", () => {
    const p = createPalette("#FB7B10", { overrides: { light: "#123456" } });
    expect(p.light).toBe("#123456");
    expect(p.main).toBe("#FB7B10");
  });
});

describe("createAppTheme", () => {
  const theme = createAppTheme(createBrandFromPrimary("Test", "#FB7B10"));

  it("帶完整 customShadows(含品牌色柔影)", () => {
    expect(theme.customShadows.primary).toContain("rgba(251, 123, 16");
    expect(theme.customShadows.z24).toBeTruthy();
  });

  it("palette 有五階主色與狀態色", () => {
    expect(theme.palette.primary.lighter).toMatch(HEX);
    expect(theme.palette.primary.darker).toMatch(HEX);
    expect(theme.palette.success.main).toBe(statusPalettes.success.main);
    expect(theme.palette.error.main).toBe(statusPalettes.error.main);
  });

  it("陰影 25 階、字級 scale 已定義", () => {
    expect(theme.shadows).toHaveLength(25);
    expect(theme.typography.h1.fontSize).toBe("2.5rem");
  });
});
