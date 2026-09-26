import { useState } from "react";

import type { Expression } from "@repo/domain/form";
import { TextField } from "@repo/ui/text-field";

import {
  constantText,
  listConstantOf,
} from "@/lib/form-engine/expression-tree";

export interface ListConstantFieldProps {
  value: Expression;
  onChange: (value: Expression) => void;
  label: string;
}

/** 清單常數:輸入框自己記住打到一半的字(「甲,」),每次改都回報解析後的清單。 */
export const ListConstantField = ({
  value,
  onChange,
  label,
}: ListConstantFieldProps) => {
  const [text, setText] = useState(() => constantText(value));
  return (
    <TextField
      label={label}
      size="small"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onChange(listConstantOf(event.target.value));
      }}
    />
  );
};
