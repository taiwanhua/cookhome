"use client";

import Box from "@mui/material/Box";
import type { KeyboardEvent } from "react";

/** 鍵盤調整欄寬的步距(px) */
const KEYBOARD_STEP = 16;

export interface DataTableResizeHandleProps {
  /** 無障礙名稱(如「調整「姓名」欄寬」) */
  label: string;
  width: number;
  minWidth: number;
  isResizing: boolean;
  /** TanStack 的 `header.getResizeHandler()`:滑鼠與觸控的拖拉起點 */
  onDragStart: (event: unknown) => void;
  /** 鍵盤左右鍵調整:傳回新的寬度 */
  onKeyboardResize: (width: number) => void;
}

/**
 * 表頭右緣的欄寬拖拉把手(`DataTable` 專用子元件)。
 * 以 WAI-ARIA 的可聚焦 separator 實作:`aria-valuenow` 是目前欄寬,左右鍵每次調 16px。
 */
export const DataTableResizeHandle = ({
  label,
  width,
  minWidth,
  isResizing,
  onDragStart,
  onKeyboardResize,
}: DataTableResizeHandleProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onKeyboardResize(Math.max(minWidth, width - KEYBOARD_STEP));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onKeyboardResize(width + KEYBOARD_STEP);
    }
  };

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={minWidth}
      tabIndex={0}
      data-resizing={isResizing || undefined}
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        event.stopPropagation();
      }}
      sx={(theme) => ({
        position: "absolute",
        top: 0,
        right: 0,
        height: "100%",
        width: theme.spacing(1),
        cursor: "col-resize",
        userSelect: "none",
        touchAction: "none",
        outline: "none",
        // 啟用態的規則寫成 `&&`:要壓過上一條「表頭 hover」較高的 specificity
        // 可見的那條線:平時不畫(表頭外觀與 `Table` 一致),滑到表頭時以分隔線提示可拖,
        // 指到把手、聚焦或拖拉中換主色。線寬 2px 是一次性直寫(STYLE-06,Figma 尚無 DataTable 稿)
        "&::after": {
          content: '""',
          position: "absolute",
          top: theme.spacing(1),
          bottom: theme.spacing(1),
          right: 0,
          width: "2px",
          borderRadius: 1,
          backgroundColor: "transparent",
        },
        ".MuiTableCell-head:hover > &::after": {
          backgroundColor: "divider",
        },
        "&&:hover::after, &&:focus-visible::after, &&[data-resizing]::after": {
          backgroundColor: "primary.main",
        },
      })}
    />
  );
};
