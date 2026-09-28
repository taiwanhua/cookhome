"use client";

import LogoutOutlined from "@mui/icons-material/LogoutOutlined";

import type { IconProps } from "./icon-props";

/**
 * 登出(Figma `Draft/AdminUserMenu` 278:77 的「登出」項)。
 * 取自 `@mui/icons-material/LogoutOutlined`,做法與理由同 `EditIcon`。
 */
export const LogoutIcon = (props: IconProps) => <LogoutOutlined {...props} />;
