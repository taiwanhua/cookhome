/** 列高 / 群組列高 / 子項縮排(theme.spacing 單位;Figma NavItem 40 高、NavGroup 36 高)。 */
export const ITEM_HEIGHT = 5;
export const GROUP_HEIGHT = 4.5;
export const CHILD_INDENT = 2.5;

/** NavLinkItem 與 NavGroupItem 共用的列樣式:圓角、內距、選中時品牌淺色底 + 深色字。 */
export const itemSx = {
  height: (theme: { spacing: (n: number) => string }) =>
    theme.spacing(ITEM_HEIGHT),
  borderRadius: 1,
  px: 1.5,
  gap: 1,
  color: "text.secondary",
  "&.Mui-selected": {
    bgcolor: "primary.lighter",
    color: "primary.dark",
    "&:hover": { bgcolor: "primary.lighter" },
  },
} as const;
