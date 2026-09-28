"use client";

import MuiToggleButton, {
  toggleButtonClasses,
} from "@mui/material/ToggleButton";
import MuiToggleButtonGroup, {
  toggleButtonGroupClasses,
} from "@mui/material/ToggleButtonGroup";
import type { SxProps, Theme } from "@mui/material/styles";
import { styled } from "@mui/material/styles";
import type { ReactNode } from "react";

import { mergeSx } from "../theme/sx";
import { radius } from "../theme/tokens";

/** 一個選項。`value` 是呼叫端自己的識別字串,切換時原樣回報。 */
export interface SegmentedOption<Value extends string> {
  value: Value;
  label: ReactNode;
  /** 文字前的圖示(`@repo/ui/icons`);尺寸由元件統一成 16 */
  icon?: ReactNode;
}

export interface SegmentedControlProps<Value extends string> {
  /** 受控:目前選中的 `SegmentedOption.value` */
  value: Value;
  /** 選了另一個選項時回報;再點一次已選的那個不回報(必定有一個選中) */
  onChange: (value: Value) => void;
  options: readonly SegmentedOption<Value>[];
  /** 整組的無障礙名稱(`role="group"` 上);ui 不內建文案(I18N-01) */
  "aria-label"?: string;
  sx?: SxProps<Theme>;
}

/*
 * 幾何照 Figma `Draft/AdminUserMenu` 278:77 的 segmented(275:88):
 * 整組內距 2、圓角 8(radius.sm);選項內距 6 / 8、圓角 6、圖示 16 與文字間距 6、文字 12(caption)。
 * 選項圓角 6 與選中陰影只有這個元件用到,依 STYLE-06 直寫。
 */
const GROUP_PADDING = 2;
const OPTION_RADIUS = 6;
const ICON_SIZE = 16;
/** 選中選項浮起來的細陰影(Figma 275:89 的 drop shadow 0 1 2 rgba(0,0,0,.08)) */
const SELECTED_SHADOW = "0 1px 2px rgba(0, 0, 0, 0.08)";

/** 深色模式要跟著換色:有 CSS 變數時取 `theme.vars`(同 `DataTable/pinned-cell-sx.ts`)。 */
const paletteOf = (theme: Theme) => (theme.vars ?? theme).palette;

const StyledGroup = styled(MuiToggleButtonGroup)(({ theme }) => ({
  padding: GROUP_PADDING,
  gap: 0,
  borderRadius: radius.sm,
  backgroundColor: paletteOf(theme).action.hover,
  [`& .${toggleButtonGroupClasses.grouped}`]: {
    // MUI 預設讓相鄰按鈕共用一條邊框、只留外側圓角;分段按鈕沒有邊框,每格各自圓角
    margin: 0,
    border: 0,
    borderRadius: OPTION_RADIUS,
  },
}));

const StyledOption = styled(MuiToggleButton)(({ theme }) => {
  const palette = paletteOf(theme);
  return {
    gap: theme.spacing(0.75),
    paddingBlock: theme.spacing(0.75),
    paddingInline: theme.spacing(1),
    ...theme.typography.caption,
    textTransform: "none",
    whiteSpace: "nowrap",
    color: palette.text.secondary,
    backgroundColor: "transparent",
    "& .MuiSvgIcon-root": { fontSize: ICON_SIZE },
    [`&.${toggleButtonClasses.selected}`]: {
      color: palette.text.primary,
      fontWeight: 600,
      backgroundColor: palette.background.paper,
      boxShadow: SELECTED_SHADOW,
      "& .MuiSvgIcon-root": { color: palette.primary.dark },
      "&:hover": { backgroundColor: palette.background.paper },
    },
  };
});

/**
 * 分段按鈕(Figma `Draft/AdminUserMenu` 278:77 的「外觀」「語言」):一組互斥選項、必定選中一個,
 * 選了立刻生效(不是表單欄位,沒有送出)。包 MUI `ToggleButtonGroup`(`exclusive`、`fullWidth`、
 * `size="small"`):每個選項是原生按鈕,`aria-pressed` 標出選中的那個;整組只佔一個 Tab 停點(MUI 的 roving tabindex),左右鍵移動、Enter / Space 選取。
 *
 * 選中 = `background.paper` 底 + 細陰影、文字 `text.primary` 半粗、圖示 `primary.dark`;
 * 未選 = 透明、`text.secondary`;整組底色 `action.hover`。
 */
export const SegmentedControl = <Value extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  sx,
}: SegmentedControlProps<Value>) => (
  <StyledGroup
    exclusive
    fullWidth
    size="small"
    value={value}
    aria-label={ariaLabel}
    sx={mergeSx({}, sx)}
    onChange={(_event, next: Value | null) => {
      // 再點已選的那個時 MUI 回 null(取消選取);分段按鈕必定有一個選中,不回報
      if (next !== null && next !== value) {
        onChange(next);
      }
    }}
  >
    {options.map((option) => (
      <StyledOption key={option.value} value={option.value}>
        {option.icon}
        {option.label}
      </StyledOption>
    ))}
  </StyledGroup>
);
