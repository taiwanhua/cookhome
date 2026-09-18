"use client";

import MuiPagination, {
  type PaginationProps as MuiPaginationProps,
} from "@mui/material/Pagination";
import { styled } from "@mui/material/styles";

export type PaginationProps = MuiPaginationProps;

/** Figma Draft/PaginationItem 76:723:選取態用 primary.lighter 底 + primary.dark 字。 */
const StyledPagination = styled(MuiPagination)(({ theme }) => ({
  "& .MuiPaginationItem-root": {
    ...theme.typography.subtitle2,
    color: theme.palette.text.secondary,
    borderRadius: theme.shape.borderRadius,
  },
  "& .MuiPaginationItem-root.Mui-selected": {
    backgroundColor: theme.palette.primary.lighter,
    color: theme.palette.primary.dark,
    "&:hover": { backgroundColor: theme.palette.primary.lighter },
  },
}));

/** MUI 預設的輔助文字是英文,依 GEN-02 換成繁中 */
const getItemAriaLabel: NonNullable<PaginationProps["getItemAriaLabel"]> = (
  type,
  page,
  selected,
) => {
  switch (type) {
    case "page": {
      return selected ? `第 ${String(page)} 頁,目前頁` : `前往第 ${String(page)} 頁`;
    }
    case "first": {
      return "前往第一頁";
    }
    case "last": {
      return "前往最後一頁";
    }
    case "previous": {
      return "前往上一頁";
    }
    default: {
      return "前往下一頁";
    }
  }
};

/**
 * 分頁器:預設圓角方塊樣式,搭配 `Table` 使用。
 * 頁碼屬於「網址能表達的狀態」(REACT-02),由呼叫端以 `page` / `onChange` 受控。
 */
export const Pagination = (props: PaginationProps) => (
  <StyledPagination
    shape="rounded"
    aria-label="分頁導覽"
    getItemAriaLabel={getItemAriaLabel}
    {...props}
  />
);
