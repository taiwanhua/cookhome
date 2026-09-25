import { useMemo, useState } from "react";

import {
  DEFAULT_WIDGET_REGISTRY,
  type FieldDef,
  type FieldType,
  type FormDefinition,
  type ValidationReport,
  validateDefinition,
} from "@repo/domain/form";

import {
  type PlaceTarget,
  type RemoveSectionMode,
  addField,
  addSection,
  moveField,
  newFieldOf,
  nextKey,
  removeField,
  removeSection,
  renameSection,
  setFieldSpan,
  updateField,
} from "@/lib/form-engine/designer-ops";

import { useRegexSafety } from "./useRegexSafety";

export interface DesignerState {
  definition: FormDefinition;
  isDirty: boolean;
  /** 前端即時檢查器(Spec 6a §5:設計器即時 + 發布時 api 再跑) */
  report: ValidationReport;
  selectedFieldKey: string | null;
  select: (fieldKey: string | null) => void;
  add: (type: FieldType, label: string, target: PlaceTarget | null) => void;
  move: (fieldKey: string, target: PlaceTarget) => void;
  remove: (fieldKey: string) => void;
  update: (fieldKey: string, next: FieldDef) => void;
  setSpan: (fieldKey: string, span: number) => void;
  addSection: (title: string) => void;
  renameSection: (sectionKey: string, title: string) => void;
  removeSection: (sectionKey: string, mode: RemoveSectionMode) => void;
  setDefinition: (next: FormDefinition) => void;
  /** 存草稿成功後把目前內容當成新的基準 */
  markSaved: () => void;
}

/**
 * 設計器的草稿狀態(初始值由外層 gate 後帶進 `useState` 初始化器,REACT-08)。
 * 所有改動都走 `lib/form-engine/designer-ops.ts` 的純函式;**刪欄位只動草稿**,引用處交給檢查器報錯。
 */
export const useDesignerState = (initial: FormDefinition): DesignerState => {
  const [definition, setDefinition] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [selectedFieldKey, select] = useState<string | null>(null);
  const regexSafety = useRegexSafety(definition);

  const report = useMemo(
    () =>
      validateDefinition(definition, {
        widgets: DEFAULT_WIDGET_REGISTRY,
        regexSafety,
      }),
    [definition, regexSafety],
  );

  const apply = (next: FormDefinition) => {
    setDefinition(next);
  };

  return {
    definition,
    isDirty: JSON.stringify(definition) !== JSON.stringify(saved),
    report,
    selectedFieldKey,
    select,
    add: (type, label, target) => {
      const key = nextKey(
        "field",
        definition.fields.map((field) => field.key),
      );
      const firstSection = definition.layout.sections.at(0);
      const place =
        target ??
        (firstSection === undefined
          ? null
          : { sectionKey: firstSection.key, beforeKey: null });
      apply(addField(definition, newFieldOf(type, key, label), place));
      select(key);
    },
    move: (fieldKey, target) => {
      apply(moveField(definition, fieldKey, target));
    },
    remove: (fieldKey) => {
      apply(removeField(definition, fieldKey));
      select(null);
    },
    update: (fieldKey, next) => {
      apply(updateField(definition, fieldKey, next));
      if (next.key !== fieldKey) {
        select(next.key);
      }
    },
    setSpan: (fieldKey, span) => {
      apply(setFieldSpan(definition, fieldKey, span));
    },
    addSection: (title) => {
      apply(addSection(definition, title));
    },
    renameSection: (sectionKey, title) => {
      apply(renameSection(definition, sectionKey, title));
    },
    removeSection: (sectionKey, mode) => {
      apply(removeSection(definition, sectionKey, mode));
    },
    setDefinition: apply,
    markSaved: () => {
      setSaved(definition);
    },
  };
};
