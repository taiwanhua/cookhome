"use client";

import Box from "@mui/material/Box";

import { CheckIcon } from "../icons/CheckIcon";

/** 方框尺寸與圓角照 Figma Draft/Checkbox 44:43(20×20、圓角 5 — 比 shape.borderRadius 更小的控制項專用值)。 */
const BOX_SIZE = 20;
const BOX_RADIUS = "5px";

export type CheckboxBoxVariant = "unchecked" | "checked" | "indeterminate";

export interface CheckboxBoxProps {
  variant?: CheckboxBoxVariant;
}

/**
 * `Checkbox` 的方框(MUI 的 icon / checkedIcon / indeterminateIcon 插槽)。
 * 停用狀態的灰化由 `Checkbox` 以 `.Mui-disabled [data-checkbox-box]` 接手 —
 * MUI 不會把 disabled 傳進自訂 icon。
 */
export const CheckboxBox = ({ variant = "unchecked" }: CheckboxBoxProps) => (
  <Box
    data-checkbox-box={variant}
    sx={{
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: BOX_SIZE,
      height: BOX_SIZE,
      borderRadius: BOX_RADIUS,
      ...(variant === "unchecked"
        ? {
            bgcolor: "background.paper",
            border: "1.5px solid",
            borderColor: "grey.400",
            // 祖先選擇器:MUI 只在 root 掛 .Mui-disabled,不會把 disabled 傳進自訂 icon
            ".Mui-disabled &": { bgcolor: "grey.200", borderColor: "grey.300" },
          }
        : {
            bgcolor: "primary.main",
            ".Mui-disabled &": { bgcolor: "grey.400" },
          }),
    }}
  >
    {variant === "checked" && (
      <CheckIcon sx={{ fontSize: BOX_SIZE, color: "common.white" }} />
    )}
    {variant === "indeterminate" && (
      <Box
        sx={{
          width: 10,
          height: 2,
          borderRadius: "1px",
          bgcolor: "common.white",
        }}
      />
    )}
  </Box>
);
