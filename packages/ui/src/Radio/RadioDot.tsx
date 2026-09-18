"use client";

import Box from "@mui/material/Box";

/** 尺寸與環寬照 Figma Draft/Radio 78:5(18×18;未選 1.5px 灰環,已選 5px 主色環 + 白心)。 */
const DOT_SIZE = 18;

export interface RadioDotProps {
  isSelected?: boolean;
}

/**
 * `Radio` 的圓點(MUI 的 icon / checkedIcon 插槽)。
 * Figma 的已選狀態是「粗主色環 + 白心」,與 MUI 預設的「外環 + 內實心點」不同,故自繪。
 */
export const RadioDot = ({ isSelected = false }: RadioDotProps) => (
  <Box
    data-radio-dot={isSelected ? "selected" : "default"}
    sx={{
      boxSizing: "border-box",
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: "50%",
      bgcolor: "background.paper",
      ...(isSelected
        ? {
            border: "5px solid",
            borderColor: "primary.main",
            // 祖先選擇器:MUI 只在 root 掛 .Mui-disabled,不會把 disabled 傳進自訂 icon
            ".Mui-disabled &": { borderColor: "grey.400" },
          }
        : {
            border: "1.5px solid",
            borderColor: "grey.400",
            ".Mui-disabled &": {
              bgcolor: "grey.200",
              borderColor: "grey.300",
            },
          }),
    }}
  />
);
