"use client";

import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";

import type { IconProps } from "./icon-props";

/**
 * 外觀「暗」(Figma `Draft/AdminUserMenu` 278:77 的外觀分段按鈕)。
 * 取自 `@mui/icons-material/DarkModeOutlined`,做法與理由同 `EditIcon`。
 */
export const DarkModeIcon = (props: IconProps) => <DarkModeOutlined {...props} />;
