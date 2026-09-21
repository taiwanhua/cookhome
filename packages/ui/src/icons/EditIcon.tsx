"use client";

import EditOutlined from "@mui/icons-material/EditOutlined";

import type { IconProps } from "./icon-props";

/**
 * 編輯(Figma `Draft/ActionIcon` 253:3264 的 `key=edit`;列表的列操作)。
 *
 * 與手繪的殼圖示不同,這顆直接取自 `@mui/icons-material/EditOutlined` —— 設計稿標的就是
 * 「取自 @mui/icons-material Outlined」,所以照 `module-icon-registry.ts` 的做法走**單檔路徑**
 * import(STYLE-05:不 `import { X } from "@mui/icons-material"`,那會把整包拖進 bundle)。
 * 顏色由 MUI `SvgIcon` 的 `fill: currentColor` 決定,跟著父層文字色走(STYLE-04)。
 */
export const EditIcon = (props: IconProps) => <EditOutlined {...props} />;
