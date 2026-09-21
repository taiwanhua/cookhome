/**
 * 收合態(圖示列)的幾何,正本 Figma `Draft/NavRailItem` 246:63 與
 * `Draft/AdminSideNavCollapsed` 246:64。
 */

/** 圖示列每一格的邊長(theme.spacing 單位;Figma 40×40)。 */
export const RAIL_ITEM_SIZE = 5;

/**
 * 群組小點(Figma 246:62 的 6×6 橢圓,距頂 / 距右各 4px)。
 * theme 沒有這麼小的尺寸 token,且只有這一個元件用得到 — 依 STYLE-06 直寫字面值並註記來源。
 */
export const GROUP_DOT_SIZE = "6px";
export const GROUP_DOT_INSET = "4px";

/** 群組 flyout 的寬度(Figma `group-flyout (示意)` 246:99:200 寬、內距 8)。 */
export const FLYOUT_WIDTH = 200;

/**
 * 圖示列一格的樣式:只有圖示、置中,選中時與展開態的 `NavItem` 同一組顏色
 * (primary.lighter 底 + primary.dark 圖示,`nav-item-styles.ts` 的 `itemSx`)。
 * `position: relative` 是給群組小點定位用的。
 */
export const railItemSx = {
  width: (theme: { spacing: (n: number) => string }) =>
    theme.spacing(RAIL_ITEM_SIZE),
  height: (theme: { spacing: (n: number) => string }) =>
    theme.spacing(RAIL_ITEM_SIZE),
  position: "relative",
  flexGrow: 0,
  px: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 1,
  color: "text.secondary",
  "&.Mui-selected": {
    bgcolor: "primary.lighter",
    color: "primary.dark",
    "&:hover": { bgcolor: "primary.lighter" },
  },
} as const;
