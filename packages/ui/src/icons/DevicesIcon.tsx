"use client";

import DevicesOutlined from "@mui/icons-material/DevicesOutlined";

import type { IconProps } from "./icon-props";

/**
 * 所有裝置(Figma `Draft/AdminUserMenu` 278:77 的「登出所有裝置」項)。
 * 取自 `@mui/icons-material/DevicesOutlined`,做法與理由同 `EditIcon`。
 */
export const DevicesIcon = (props: IconProps) => <DevicesOutlined {...props} />;
