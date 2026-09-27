import { LAYOUT_COLUMNS, spanFor } from "@repo/domain/form";

/**
 * 版面的 12 格制(Spec 6a §5 Layout):桌機用 `span`、平板 `span × 2` 封頂 12、手機一律 12
 * (換算正本 `@repo/domain/form` 的 `spanFor`)。`@repo/ui` 沒有 Grid 元件,這裡以 CSS grid 排,
 * 斷點用 theme 的 `xs` / `sm` / `md`。
 */
export const sectionGridSx = {
  display: "grid",
  gridTemplateColumns: `repeat(${String(LAYOUT_COLUMNS)}, minmax(0, 1fr))`,
  columnGap: 2,
  rowGap: 2,
} as const;

export const cellSpanSx = (span: number) => ({
  gridColumn: {
    xs: `span ${String(spanFor(span, "mobile"))}`,
    sm: `span ${String(spanFor(span, "tablet"))}`,
    md: `span ${String(spanFor(span, "desktop"))}`,
  },
  minWidth: 0,
});
