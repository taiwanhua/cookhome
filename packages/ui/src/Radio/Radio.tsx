"use client";

import MuiRadio, {
  type RadioProps as MuiRadioProps,
} from "@mui/material/Radio";

import { mergeSx } from "../theme/sx";
import { RadioDot } from "./RadioDot";

export type RadioProps = MuiRadioProps;

/**
 * 單選鈕(Figma Components / Radio 78:2 的 Draft/Radio 78:5)。
 * 圓點由 `RadioDot` 供給;多選一的群組用同資料夾的 `RadioGroup`。
 */
export const Radio = ({ sx, ...rest }: RadioProps) => (
  <MuiRadio
    icon={<RadioDot />}
    checkedIcon={<RadioDot isSelected />}
    sx={mergeSx({ borderRadius: "50%" }, sx)}
    {...rest}
  />
);
