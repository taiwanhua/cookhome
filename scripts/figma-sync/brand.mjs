/**
 * 專案品牌的 Figma 投影:六色、Brand → Color aliases、primary effect。無 Figma I/O。
 * 唯一輸入是 `projectPublic.brand`(name、primary);色階與陰影一律取 `@repo/ui/theme` 的既有推導,
 * 不解析 TS 原碼、不另填六色、不以硬編碼數值備援。
 */
import { createBrandFromPrimary, createCustomShadows } from "@repo/ui/theme";

const ROLES = ["lighter", "light", "main", "dark", "darker", "contrast"];
const HEX = /^#[0-9A-Fa-f]{6}$/;
/** 目前唯一支援的陰影語法:`<x> <y>px <blur>px <spread> rgba(r, g, b, a)`(單一 shadow)。 */
const SHADOW =
  /^(-?\d+)(?:px)? (-?\d+)(?:px)? (\d+)(?:px)? (-?\d+)(?:px)? rgba\((\d{1,3}), (\d{1,3}), (\d{1,3}), (0|1|0?\.\d+)\)$/;

function hexToRgba(hex) {
  if (typeof hex !== "string" || !HEX.test(hex)) {
    throw new Error("BRAND_COLOR_INVALID");
  }
  const channel = (offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return { r: channel(1), g: channel(3), b: channel(5), a: 1 };
}

/** CSS box-shadow → Figma DROP_SHADOW;未知語法拒絕。alpha 取陰影自己的值,不沿用主色綁定的 1。 */
function shadowToEffect(css) {
  const match = typeof css === "string" ? SHADOW.exec(css) : null;
  if (!match) throw new Error("BRAND_SHADOW_UNSUPPORTED");
  const [x, y, blur, spread, r, g, b, alpha] = match.slice(1).map(Number);
  if ([r, g, b].some((channel) => channel > 255)) {
    throw new Error("BRAND_SHADOW_UNSUPPORTED");
  }
  return {
    type: "DROP_SHADOW",
    color: { r: r / 255, g: g / 255, b: b / 255, a: alpha },
    offset: { x, y },
    radius: blur,
    spread,
    visible: true,
    blendMode: "NORMAL",
  };
}

export function createFigmaBrandProjection(projectPublic) {
  const { name, primary } = projectPublic.brand;
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("BRAND_NAME_INVALID");
  }
  hexToRgba(primary);
  const palette = createBrandFromPrimary(name, primary).primary;
  // Figma 的 contrast 對應程式的 contrastText,其餘五角色同名
  const hexOf = (role) =>
    role === "contrast" ? palette.contrastText : palette[role];
  return {
    name,
    primary: Object.fromEntries(
      ROLES.map((role) => [role, hexToRgba(hexOf(role))]),
    ),
    aliases: ROLES.map((role) => ({
      role,
      collectionRole: "Color",
      name: `primary/${role}`,
      target: { collectionRole: "Brand", name: `primary/${role}` },
    })),
    primaryEffect: shadowToEffect(createCustomShadows(palette.main).primary),
  };
}
