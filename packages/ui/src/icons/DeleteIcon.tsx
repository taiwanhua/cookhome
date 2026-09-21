"use client";

import DeleteOutlined from "@mui/icons-material/DeleteOutlined";

import type { IconProps } from "./icon-props";

/**
 * 刪除(Figma `Draft/ActionIcon` 253:3264 的 `key=delete`;列表的列操作)。
 * 取自 `@mui/icons-material/DeleteOutlined`,做法與理由同 `EditIcon`。
 */
export const DeleteIcon = (props: IconProps) => <DeleteOutlined {...props} />;
