import type { FieldDef } from "@repo/domain/form";
import { TextField } from "@repo/ui/text-field";

import {
  type FormDisplayItemLike,
  type FormValueRenderContext,
  displayTextOf,
} from "@/lib/form-engine/value-text";

export interface DerivedFieldCellProps {
  field: FieldDef;
  value: unknown;
  display?: readonly FormDisplayItemLike[];
  text: FormValueRenderContext["text"];
  /** api 回的值錯誤(計算結果不合規則,例:必填的總額算不出來) */
  errorMessage?: string | null;
}

/**
 * 計算 / 固定值欄位在設計畫布、填寫、預覽的樣子(Spec 6a §5 表 A 下方):**有框的唯讀輸入框**,
 * 外觀與其他停用的欄位一致;內容是顯示值(數字帶單位、選項顯示名;計算欄位缺依賴時是「—」)。
 */
export const DerivedFieldCell = ({
  field,
  value,
  display,
  text,
  errorMessage,
}: DerivedFieldCellProps) => {
  const hasError = errorMessage !== undefined && errorMessage !== null;
  const help = field.help ?? "";
  const helperText = hasError ? errorMessage : help;

  return (
    <TextField
      label={field.label}
      value={displayTextOf({
        field,
        value,
        text,
        ...(display !== undefined && { display }),
      })}
      disabled
      fullWidth
      size="small"
      error={hasError}
      {...(helperText !== "" && { helperText })}
      slotProps={{ htmlInput: { readOnly: true } }}
    />
  );
};
