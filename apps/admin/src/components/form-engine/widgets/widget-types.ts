import type { ComponentType, ReactNode } from "react";

import type { FieldDef } from "@repo/domain/form";

/**
 * widget 登錄表的共同介面(Spec 6a §5:`type` 決定存什麼、`widget.kind` 決定怎麼畫)。
 * widget 收發的一律是**存值形狀**(§5「值的存法」):靜態選項存 value 字串、類別 / lookup 選項存
 * `{ value, label }`、`allowCustom` 自訂值多一個 `custom: true`、引用存 `{ id, label }`、上傳存
 * `{ path, name, size, contentType }`。數字存十進位字串(送出時 api 依 `precision` 取位)。
 */
export interface WidgetContext {
  formKey: string;
  /** 已發布 / 退役版的版號;設計器預覽(草稿)為 null —— lookup 依它決定查哪一版的定義 */
  version: number | null;
}

export interface WidgetProps {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  /** 唯讀(計算欄位、沒有欄位級 edit、`readonlyWhen`、設計 / 唯讀模式) */
  isDisabled: boolean;
  /** 設計模式:只畫外觀、不查選項 */
  isDesign: boolean;
  /** 欄位下方的說明(help、唯讀原因、api 回的錯誤) */
  helperText?: ReactNode;
  hasError: boolean;
  context: WidgetContext;
}

export type WidgetComponent = ComponentType<WidgetProps>;

/** 選項欄的一個可選項:`stored` 是選它之後要存的值。 */
export interface ChoiceOption {
  value: string;
  label: string;
  stored: unknown;
}
