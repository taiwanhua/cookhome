"use client";

import MuiRadioGroup, {
  type RadioGroupProps as MuiRadioGroupProps,
} from "@mui/material/RadioGroup";

export type RadioGroupProps = MuiRadioGroupProps;

/**
 * 單選群組(啟用方式、所屬組織變更的三檔…)。
 * 子項用 `FormControlLabel` + `Radio`;群組本身沒有視覺樣式,純粹管 name / value / onChange。
 */
export const RadioGroup = (props: RadioGroupProps) => (
  <MuiRadioGroup {...props} />
);
