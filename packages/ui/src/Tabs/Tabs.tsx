"use client";

import MuiTab from "@mui/material/Tab";
import MuiTabs from "@mui/material/Tabs";
import type { SxProps, Theme } from "@mui/material/styles";
import { styled } from "@mui/material/styles";
import type { ReactNode } from "react";

import { mergeSx } from "../theme/sx";

/** 一個頁籤。`value` 是呼叫端自己的識別字串(不是索引),切換時原樣回報。 */
export interface TabItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  /** 給輔助科技的名稱;`label` 不是純文字時才需要 */
  "aria-label"?: string;
}

export interface TabsProps {
  /** 受控:目前選中的 `TabItem.value`;不在 `items` 裡時整列都不選中 */
  value: string;
  /** 切到另一個頁籤時回報;切不切得成由呼叫端決定(可能被「放棄未儲存變更」攔下) */
  onChange: (value: string) => void;
  items: readonly TabItem[];
  /** 整列頁籤的無障礙名稱(`role="tablist"` 上);ui 不內建文案(I18N-01) */
  "aria-label"?: string;
  sx?: SxProps<Theme>;
}

/**
 * Figma `Draft/Tabs` 252:14:頁籤列**下方一條 1px 分隔線**,選中的那格用主色底線
 * (底線本身是 MUI 的 indicator,`Draft/Tab` 69:655 的 Active 變體)。
 * 字重與 textTransform 已由 theme 的 `MuiTab` 覆寫供給(SemiBold、不轉大寫)。
 */
const StyledTabs = styled(MuiTabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  minHeight: "auto",
  "& .MuiTab-root": {
    minHeight: "auto",
    minWidth: "auto",
    paddingInline: theme.spacing(1),
    paddingBlock: theme.spacing(1.25),
  },
  "& .MuiTabs-indicator": { height: 2, borderRadius: 1 },
}));

/**
 * 頁內頁籤(角色管理頁的「權限設定 / 分配使用者」)。
 *
 * **不是殼的 `RouteTabs`** —— 那一列是路由,這個只是同一頁裡的分區,
 * 所以不進 URL(REACT-02 第 2 點的 admin 例外)。受控:`value` / `onChange` 由呼叫端持有,
 * 切換可以被攔下(未儲存變更)。
 */
export const Tabs = ({
  value,
  onChange,
  items,
  "aria-label": ariaLabel,
  sx,
}: TabsProps) => (
  <StyledTabs
    // 值不在清單裡(載入中、剛換掉資料)時傳 false,MUI 才不會在 console 警告
    value={items.some((item) => item.value === value) ? value : false}
    aria-label={ariaLabel}
    sx={mergeSx({}, sx)}
    onChange={(_event, next: string) => {
      onChange(next);
    }}
  >
    {items.map((item) => (
      <MuiTab
        key={item.value}
        value={item.value}
        label={item.label}
        disabled={item.disabled}
        aria-label={item["aria-label"]}
      />
    ))}
  </StyledTabs>
);
