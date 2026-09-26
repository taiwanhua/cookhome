"use client";

import type { SxProps, Theme } from "@mui/material/styles";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker as MuiDateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs, { type Dayjs } from "dayjs";
import timezonePlugin from "dayjs/plugin/timezone";
import utcPlugin from "dayjs/plugin/utc";
import type { ReactNode } from "react";

import "dayjs/locale/zh-tw";

// MUI X 的 `timezone` 需要 dayjs 的 utc + timezone 外掛(擴充一次,對整個 dayjs 生效)
/* eslint-disable import-x/no-named-as-default-member -- dayjs 的發佈檔是 UMD,具名的 `extend` 在 node ESM(admin 的 jest)解析不到;MUI 的 AdapterDayjs 也是以預設匯出呼叫 `extend`。到期條件:dayjs 提供真正的 ESM 具名匯出 */
dayjs.extend(utcPlugin);
dayjs.extend(timezonePlugin);
/* eslint-enable import-x/no-named-as-default-member */

/** 預設顯示格式(24 小時制,與 `DatePicker` 的 `YYYY-MM-DD` 同一族)。 */
const DISPLAY_FORMAT = "YYYY-MM-DD HH:mm";

/** 日曆的語系資料(不是 UI 文案 — ui 套件不做 i18n,文字一律由 props 傳入,I18N-01)。 */
export type DateTimePickerLocale = "zh-tw" | "en";

export interface DateTimePickerProps {
  /** 浮動標籤;ui 不內建文案 */
  label?: ReactNode;
  /**
   * 受控值:ISO 8601 時點(任何時區標記都收,如 `2026-03-01T01:30:00Z`);清空為 `null`。
   * 畫面以 `timezone` 顯示這個時點的牆上時間。
   */
  value?: string | null;
  /** 非受控的初始值,格式同 `value` */
  defaultValue?: string | null;
  /**
   * 選到時間時回傳 **UTC** 的 ISO 8601(`YYYY-MM-DDTHH:mm:ssZ`,秒以下捨去);清空或輸入不合法回 `null`。
   */
  onChange?: (value: string | null) => void;
  /**
   * 輸入與顯示用的 IANA 時區(如 `Asia/Taipei`,表單引擎傳租戶時區);預設瀏覽器時區。
   */
  timezone?: string;
  /** 可選範圍(含),格式同 `value` */
  minDateTime?: string;
  maxDateTime?: string;
  /* 以下沿用 MUI 的名字而不自創(STYLE-05 / FIGMA-01:包裝層能透傳就透傳) */
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  fullWidth?: boolean;
  name?: string;
  /** 輸入格高度,與 `TextField` / `DatePicker` 同一組名字 */
  size?: "small" | "medium";
  /** 顯示格式;預設 `YYYY-MM-DD HH:mm` */
  format?: string;
  locale?: DateTimePickerLocale;
  sx?: SxProps<Theme>;
}

/** 對外的 ISO 字串 ↔ 內部的 Dayjs(UTC 時點);`undefined` 原樣傳下去,受控 / 非受控才不會被誤判。 */
const toDate = (value: string | null | undefined): Dayjs | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? null : dayjs.utc(value);
};

/** 內部 Dayjs(任何時區)→ UTC ISO 字串(秒以下捨去)。 */
const toValue = (date: Dayjs | null): string | null =>
  date?.isValid() === true
    ? `${date.utc().format("YYYY-MM-DDTHH:mm:ss")}Z`
    : null;

/**
 * 日期時間選擇(MUI X Date Pickers 社群版 / MIT,dayjs adapter + utc / timezone 外掛)。
 * 對外只收發 ISO 8601 字串(送出一律 UTC),呼叫端不必碰 dayjs,也不必自己掛 `LocalizationProvider`;
 * 以 `timezone` 輸入與顯示(表單引擎的 `datetime` 欄位以租戶時區呈現,存 UTC)。
 * 外觀同 `DatePicker`:outlined `TextField` 加日曆按鈕,幾何由 theme 的 `MuiOutlinedInput` 供給(STYLE-07)。
 */
export const DateTimePicker = ({
  label,
  value,
  defaultValue,
  onChange,
  timezone,
  minDateTime,
  maxDateTime,
  disabled,
  readOnly,
  required,
  error,
  helperText,
  fullWidth,
  name,
  size,
  format = DISPLAY_FORMAT,
  locale = "zh-tw",
  sx,
}: DateTimePickerProps) => (
  <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale}>
    <MuiDateTimePicker
      label={label}
      value={toDate(value)}
      defaultValue={toDate(defaultValue)}
      onChange={(date) => onChange?.(toValue(date))}
      timezone={timezone ?? "system"}
      minDateTime={toDate(minDateTime) ?? undefined}
      maxDateTime={toDate(maxDateTime) ?? undefined}
      disabled={disabled}
      readOnly={readOnly}
      format={format}
      ampm={false}
      sx={sx}
      slotProps={{
        textField: { required, error, helperText, fullWidth, name, size },
      }}
    />
  </LocalizationProvider>
);
