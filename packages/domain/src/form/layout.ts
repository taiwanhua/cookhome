import type { Layout } from "./types";

/** 版面換算(Spec §5 Layout):12 格制,桌機用 `span`、平板 `span × 2` 封頂 12、手機一律 12。 */
export const LAYOUT_COLUMNS = 12;

export const LAYOUT_BREAKPOINTS = ["desktop", "tablet", "mobile"] as const;

export type LayoutBreakpoint = (typeof LAYOUT_BREAKPOINTS)[number];

export function spanFor(span: number, breakpoint: LayoutBreakpoint): number {
  switch (breakpoint) {
    case "desktop": {
      return Math.min(span, LAYOUT_COLUMNS);
    }
    case "tablet": {
      return Math.min(span * 2, LAYOUT_COLUMNS);
    }
    case "mobile": {
      return LAYOUT_COLUMNS;
    }
  }
}

/** 整份版面換算到某斷點(結構不變,只換每格的 `span`)。 */
export function resolveLayout(
  layout: Layout,
  breakpoint: LayoutBreakpoint,
): Layout {
  return {
    sections: layout.sections.map((section) => ({
      ...section,
      rows: section.rows.map((row) => ({
        cols: row.cols.map((col) => ({
          ...col,
          span: spanFor(col.span, breakpoint),
        })),
      })),
    })),
  };
}

/** 版面裡出現的欄位 key(依出現順序,重複的照列)。 */
export function layoutFieldKeys(layout: Layout): string[] {
  return layout.sections.flatMap((section) =>
    section.rows.flatMap((row) => row.cols.map((col) => col.fieldKey)),
  );
}
