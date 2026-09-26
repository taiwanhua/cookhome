import { DEFAULT_WIDGET_REGISTRY } from "@repo/domain/form";

import { ReferenceField } from "../ReferenceField";
import { BooleanWidget } from "./BooleanWidget";
import { ChoiceWidget } from "./ChoiceWidget";
import { DateTimeWidget } from "./DateTimeWidget";
import { DateWidget } from "./DateWidget";
import { MultiChoiceWidget } from "./MultiChoiceWidget";
import { NumberWidget } from "./NumberWidget";
import { TextWidget } from "./TextWidget";
import { UploadWidget } from "./UploadWidget";
import type { WidgetComponent } from "./widget-types";

/**
 * admin 的 widget 登錄表(Spec 6a §5:`widget.kind` → 元件)。與 domain 的
 * `DEFAULT_WIDGET_REGISTRY`(型別 → 可用的 kind,檢查器用)成對:**擴充一個 widget = 兩邊各加一筆**。
 * 同一個元件可以負責好幾個 kind(單選的三種都是 `ChoiceWidget`,依 `widget.kind` 換畫法)。
 */
export const WIDGET_REGISTRY: Readonly<Record<string, WidgetComponent>> = {
  textField: TextWidget,
  textArea: TextWidget,
  number: NumberWidget,
  datePicker: DateWidget,
  dateTimePicker: DateTimeWidget,
  dropdown: ChoiceWidget,
  radio: ChoiceWidget,
  autocomplete: ChoiceWidget,
  checkboxGroup: MultiChoiceWidget,
  multiDropdown: MultiChoiceWidget,
  autocompleteMulti: MultiChoiceWidget,
  switch: BooleanWidget,
  checkbox: BooleanWidget,
  upload: UploadWidget,
  referencePicker: ReferenceField,
};

/** 登錄表裡有、domain 也認得的 kind(設計器的 widget 下拉只列這些)。 */
export const widgetKindsFor = (
  type: keyof typeof DEFAULT_WIDGET_REGISTRY,
): readonly string[] =>
  DEFAULT_WIDGET_REGISTRY[type].filter((kind) => kind in WIDGET_REGISTRY);

/** 認不得的 kind(檢查器會報 `WIDGET_UNKNOWN`)退回純文字欄,畫面不炸。 */
export const widgetOf = (kind: string): WidgetComponent =>
  WIDGET_REGISTRY[kind] ?? TextWidget;
