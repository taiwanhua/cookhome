"use client";

import SettingsBrightnessOutlined from "@mui/icons-material/SettingsBrightnessOutlined";

import type { IconProps } from "./icon-props";

/**
 * 外觀「跟隨系統」(Figma `Draft/AdminUserMenu` 278:77 的外觀分段按鈕)。
 * 取自 `@mui/icons-material/SettingsBrightnessOutlined`,做法與理由同 `EditIcon`。
 */
export const SystemModeIcon = (props: IconProps) => <SettingsBrightnessOutlined {...props} />;
