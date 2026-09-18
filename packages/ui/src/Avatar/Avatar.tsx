"use client";

import MuiAvatar, {
  type AvatarProps as MuiAvatarProps,
} from "@mui/material/Avatar";

export type AvatarProps = MuiAvatarProps;

/** 頭像(AppBar 使用者:品牌淺色底 + 姓氏首字,對應 Figma AdminAppBar 20:55)。 */
export const Avatar = (props: AvatarProps) => <MuiAvatar {...props} />;
