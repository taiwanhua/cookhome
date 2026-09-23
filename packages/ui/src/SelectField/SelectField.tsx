"use client";

import type { SxProps, Theme } from "@mui/material/styles";
import { Fragment, type ReactNode } from "react";

import { Checkbox } from "../Checkbox/Checkbox";
import { MenuItem } from "../Menu/MenuItem";
import { TextField } from "../TextField/TextField";

/** 一個選項;`value` 是穩定識別,`label` 是畫面上的字(ui 不內建文案,I18N-01)。 */
export interface SelectFieldOption<Value extends string = string> {
  value: Value;
  label: ReactNode;
  /** 灰掉不可選(如管理範圍外的組織) */
  disabled?: boolean;
}

interface SelectFieldCommonProps<Value extends string> {
  /** 浮動標籤,同時是 combobox 的無障礙名稱(MUI 以 `aria-labelledby` 指向它) */
  label: ReactNode;
  options: readonly SelectFieldOption<Value>[];
  /** 欄位下方的說明;`error` 時轉成錯誤色 */
  helperText?: ReactNode;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
  /**
   * 值為 `""` 時仍顯示那個選項的文字(「未指定」、「全部」這類空值項)。
   * 空值項由呼叫端放進 `options`(`{ value: "", label: … }`),所以 `onChange` 收到的
   * `""` 仍是 `Value` 的一員、不必轉型;開了這個,標籤會釘在上緣,不會壓在空值文字上。
   */
  displayEmpty?: boolean;
  /** 只放版面位置(寬度、間距);幾何由元件決定(STYLE-10) */
  sx?: SxProps<Theme>;
}

export interface SingleSelectFieldProps<
  Value extends string,
> extends SelectFieldCommonProps<Value> {
  multiple?: false;
  /** 受控值;`""` 表示尚未選(配 `displayEmpty` 與空值項使用) */
  value: NoInfer<Value> | "";
  onChange: (value: NoInfer<Value>) => void;
}

export interface MultipleSelectFieldProps<
  Value extends string,
> extends SelectFieldCommonProps<Value> {
  /** 多選:選項前面帶勾選框,收合時顯示 `renderValue` 的摘要 */
  multiple: true;
  value: readonly NoInfer<Value>[];
  /** 回傳整個陣列,**依點選的先後排列**(新點的在最後),不是依選項順序 */
  onChange: (value: NoInfer<Value>[]) => void;
  /** 收合時的摘要;不給時把選到的選項文字以「, 」串起來 */
  renderValue?: (value: readonly NoInfer<Value>[]) => ReactNode;
}

export type SelectFieldProps<Value extends string = string> =
  SingleSelectFieldProps<Value> | MultipleSelectFieldProps<Value>;

/**
 * 表單下拉(Figma Draft/Select 70:219 的 outlined 變體:浮動標籤 + 外框)。
 * **admin / front 的表單下拉一律用它**,不要再用裸 `Select` 配自畫的 `Typography` 標題。
 *
 * **包法:MUI `TextField select`,不是 `FormControl` + `InputLabel` + `Select`**。理由:
 * - 標籤、`helperText`、`error`、`fullWidth`、`size` 與同一張表單裡的 `TextField` 走同一套
 *   元件,高度、間距、錯誤色自然一致,不必手動對齊三個零件;
 * - `TextField` 自動產生標籤 id 並接到 combobox 的 `aria-labelledby`,無障礙名稱 = `label`,
 *   呼叫端不必再補 `aria-label`;
 * - `@repo/ui/module-icon-picker` 也是這個包法,兩者外觀不會分岔。
 *
 * 換回 `onChange` 的值時以 `options` 查表,而不是轉型 `event.target.value`:
 * 型別因此不必 `as`(`Value` 可以是 enum / 字面量聯集),查不到的值直接忽略。
 * `Value` 只由 `options` 推導(`value` / `onChange` 標 `NoInfer`),所以選項是字面量時
 * 型別會是整組選項的聯集,不會被當下的 `value` 窄化成單一字面量。
 * 需要搜尋、分組、次文字或 chip 的多選時改用 `@repo/ui/autocomplete`(STYLE-05)。
 */
export const SelectField = <Value extends string>(
  props: SelectFieldProps<Value>,
) => {
  const optionByValue = new Map<string, SelectFieldOption<Value>>(
    props.options.map((option) => [option.value, option]),
  );

  const handleChange = (raw: unknown) => {
    if (props.multiple === true) {
      // MUI 多選回陣列;瀏覽器自動填入時可能回逗號字串(MUI 文件的做法)
      const items = Array.isArray(raw) ? raw : String(raw).split(",");
      props.onChange(
        items.flatMap((item) => {
          const option = optionByValue.get(String(item));
          return option === undefined ? [] : [option.value];
        }),
      );
      return;
    }
    const option = optionByValue.get(String(raw));
    if (option !== undefined) {
      props.onChange(option.value);
    }
  };

  const renderMultiple = (selected: unknown): ReactNode => {
    const values = (Array.isArray(selected) ? selected : []).flatMap((item) => {
      const option = optionByValue.get(String(item));
      return option === undefined ? [] : [option.value];
    });
    const custom = props.multiple === true ? props.renderValue : undefined;
    const summary: ReactNode =
      custom === undefined ? (
        <>
          {values.map((value, index) => (
            <Fragment key={value}>
              {index > 0 && ", "}
              {optionByValue.get(value)?.label}
            </Fragment>
          ))}
        </>
      ) : (
        custom(values)
      );
    return summary;
  };

  const selectedValues: readonly string[] =
    props.multiple === true ? props.value : [];

  return (
    <TextField
      select
      label={props.label}
      value={props.multiple === true ? [...props.value] : props.value}
      helperText={props.helperText}
      error={props.error}
      disabled={props.disabled}
      required={props.required}
      fullWidth={props.fullWidth}
      size={props.size}
      sx={props.sx}
      onChange={(event) => {
        handleChange(event.target.value);
      }}
      slotProps={{
        select: {
          multiple: props.multiple === true,
          displayEmpty: props.displayEmpty,
          ...(props.multiple === true ? { renderValue: renderMultiple } : {}),
        },
        // MUI 只在值非空時才自動收起標籤;顯示空值項時要釘住,否則壓在文字上
        ...(props.displayEmpty === true
          ? { inputLabel: { shrink: true } }
          : {}),
      }}
    >
      {props.options.map((option) => (
        <MenuItem
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {props.multiple === true && (
            <Checkbox checked={selectedValues.includes(option.value)} />
          )}
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
};
