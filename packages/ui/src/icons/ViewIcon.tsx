"use client";

import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";

import type { IconProps } from "./icon-props";

/**
 * 檢視(Figma `Draft/ActionIcon` 253:3264 的 `key=view`;列表的列操作)。
 * 取自 `@mui/icons-material/VisibilityOutlined`,做法與理由同 `EditIcon`。
 */
export const ViewIcon = (props: IconProps) => <VisibilityOutlined {...props} />;
