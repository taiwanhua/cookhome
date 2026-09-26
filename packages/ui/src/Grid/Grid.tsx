"use client";

import MuiGrid, { type GridProps as MuiGridProps } from "@mui/material/Grid";

/**
 * 12 格版面(MUI Grid v2 的直通包裝,STYLE-05):
 *
 * - 容器 `<Grid container spacing={2}>`,格子 `<Grid size={{ xs: 12, sm: 6, md: 4 }}>`;
 *   `size` 用 theme 的斷點物件(STYLE-03),預設 12 欄(`columns` 可改)
 * - 只排「欄」:直向堆疊用 `Stack`(Grid 的 `direction` 只支援 row)
 * - 間距一律 theme spacing 的倍數(`spacing={2}`),不寫裸 px(STYLE-01)
 *
 * 表單引擎的版面(`spanFor` 換算的桌機 / 平板 / 手機三段 span)就是用它排的。
 */
export type GridProps = MuiGridProps;

export const Grid = (props: GridProps) => <MuiGrid {...props} />;
