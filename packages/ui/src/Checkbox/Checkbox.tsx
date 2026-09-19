"use client";

import MuiCheckbox, {
  type CheckboxProps as MuiCheckboxProps,
} from "@mui/material/Checkbox";

import { mergeSx } from "../theme/sx";
import { CheckboxBox } from "./CheckboxBox";

export type CheckboxProps = MuiCheckboxProps;

/**
 * 勾選框(Figma Components / Checkbox 70:218 的 Draft/Checkbox 44:43)。
 * 方框由 `CheckboxBox` 供給(20×20、圓角 5、勾號用 CheckIcon)。
 * Enabled=False 的灰化用於防越權下放與 wildcard 隱含勾選,樣式寫在 `CheckboxBox`。
 */
export const Checkbox = ({ sx, ...rest }: CheckboxProps) => (
  <MuiCheckbox
    icon={<CheckboxBox />}
    checkedIcon={<CheckboxBox variant="checked" />}
    indeterminateIcon={<CheckboxBox variant="indeterminate" />}
    sx={mergeSx({ borderRadius: 1 }, sx)}
    {...rest}
  />
);
