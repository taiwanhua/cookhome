"use client";

import LightModeOutlined from "@mui/icons-material/LightModeOutlined";

import type { IconProps } from "./icon-props";

/**
 * 外觀「亮」(Figma `Draft/AdminUserMenu` 278:77 的外觀分段按鈕)。
 * 取自 `@mui/icons-material/LightModeOutlined`,做法與理由同 `EditIcon`。
 */
export const LightModeIcon = (props: IconProps) => <LightModeOutlined {...props} />;
