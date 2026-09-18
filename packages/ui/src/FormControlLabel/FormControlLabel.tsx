"use client";

import MuiFormControlLabel, {
  type FormControlLabelProps as MuiFormControlLabelProps,
} from "@mui/material/FormControlLabel";

export type FormControlLabelProps = MuiFormControlLabelProps;

/**
 * 勾選框 / 單選鈕 / 開關的標籤外框(`control` 插槽 + `label`)。
 * Checkbox、Radio、Switch 共用一份,所以獨立成子路徑 — 不然三個子路徑各匯出一份會變成三個副本。
 */
export const FormControlLabel = (props: FormControlLabelProps) => (
  <MuiFormControlLabel {...props} />
);
