import {
  DEFAULT_WIDGET_REGISTRY,
  type FieldDef,
  type FieldType,
  type FormDefinition,
  LAYOUT_COLUMNS,
  type LayoutCol,
  type LayoutSection,
  layoutFieldKeys,
} from "@repo/domain/form";

/**
 * 設計器對草稿定義的操作(純函式,設計器與測試共用;Spec 6a §5、§8「設計器其他規則」)。
 *
 * 版面以「每個分區一串欄位」操作:拖拉只改順序與所屬分區,列(`rows`)依 `span` 由左而右重新裝箱
 * (一列加總不超過 12 格),所以拖拉之後不會出現超過 12 格的列。
 *
 * **刪欄位只動草稿的 `fields[]` 與 `layout`**:公式、條件、摘要槽、帶入規則若還引用它,
 * 就變成檢查器錯誤(定位到引用處)由設計者手動修,這裡不自動改、不自動清。
 */

export const DEFAULT_SPAN = 6;

/** 分區裡的欄位(依版面順序)。 */
export const sectionCols = (section: LayoutSection): LayoutCol[] =>
  section.rows.flatMap((row) => row.cols);

/** 一串欄位依 span 裝箱成列。 */
export const packRows = (cols: readonly LayoutCol[]): LayoutSection["rows"] => {
  const rows: LayoutSection["rows"] = [];
  let current: LayoutCol[] = [];
  let used = 0;
  for (const col of cols) {
    if (current.length > 0 && used + col.span > LAYOUT_COLUMNS) {
      rows.push({ cols: current });
      current = [];
      used = 0;
    }
    current.push(col);
    used += col.span;
  }
  if (current.length > 0) {
    rows.push({ cols: current });
  }
  return rows;
};

const withSectionCols = (
  section: LayoutSection,
  cols: readonly LayoutCol[],
): LayoutSection => ({ ...section, rows: packRows(cols) });

/** 下一個沒用過的 key(`<prefix>_<n>`)。 */
export const nextKey = (prefix: string, used: Iterable<string>): string => {
  const taken = new Set(used);
  let index = 1;
  while (taken.has(`${prefix}_${String(index)}`)) {
    index += 1;
  }
  return `${prefix}_${String(index)}`;
};

/** 新欄位的預設定義(widget 取該型別登錄表的第一個)。 */
export const newFieldOf = (
  type: FieldType,
  key: string,
  label: string,
): FieldDef => ({
  key,
  label,
  type,
  ...(type === "number" && { precision: 0 }),
  widget: { kind: DEFAULT_WIDGET_REGISTRY[type][0] ?? "textField" },
  valueSource: { kind: "input" },
  options:
    type === "select" || type === "multiSelect"
      ? { kind: "static", items: [] }
      : null,
  rules: { required: false },
  permission: { show: false, edit: false },
  help: null,
});

export interface PlaceTarget {
  sectionKey: string;
  /** 放在這個欄位前面;null = 放在分區最後 */
  beforeKey: string | null;
}

const placeCol = (
  sections: readonly LayoutSection[],
  col: LayoutCol,
  target: PlaceTarget,
): LayoutSection[] =>
  sections.map((section) => {
    if (section.key !== target.sectionKey) {
      return section;
    }
    const cols = sectionCols(section);
    const index =
      target.beforeKey === null
        ? -1
        : cols.findIndex((item) => item.fieldKey === target.beforeKey);
    const next =
      index === -1
        ? [...cols, col]
        : [...cols.slice(0, index), col, ...cols.slice(index)];
    return withSectionCols(section, next);
  });

const withoutCol = (
  sections: readonly LayoutSection[],
  fieldKey: string,
): LayoutSection[] =>
  sections.map((section) =>
    withSectionCols(
      section,
      sectionCols(section).filter((col) => col.fieldKey !== fieldKey),
    ),
  );

const colOf = (
  sections: readonly LayoutSection[],
  fieldKey: string,
): LayoutCol | undefined =>
  sections
    .flatMap((section) => sectionCols(section))
    .find((col) => col.fieldKey === fieldKey);

export const addField = (
  definition: FormDefinition,
  field: FieldDef,
  target: PlaceTarget | null,
): FormDefinition => {
  const col = { fieldKey: field.key, span: DEFAULT_SPAN };
  return {
    ...definition,
    fields: [...definition.fields, field],
    layout: {
      sections:
        target === null
          ? definition.layout.sections
          : placeCol(definition.layout.sections, col, target),
    },
  };
};

/** 拖拉:移到某分區的某欄之前(或分區最後);欄寬沿用。沒放進版面的欄位從「未放置」拉進來也走這裡。 */
export const moveField = (
  definition: FormDefinition,
  fieldKey: string,
  target: PlaceTarget,
): FormDefinition => {
  if (target.beforeKey === fieldKey) {
    return definition;
  }
  const col = colOf(definition.layout.sections, fieldKey) ?? {
    fieldKey,
    span: DEFAULT_SPAN,
  };
  const sections = withoutCol(definition.layout.sections, fieldKey);
  return {
    ...definition,
    layout: { sections: placeCol(sections, col, target) },
  };
};

/** 只從草稿的 `fields[]` 與 `layout` 移除;引用處不動(Spec §5「草稿裡刪欄位」)。 */
export const removeField = (
  definition: FormDefinition,
  fieldKey: string,
): FormDefinition => ({
  ...definition,
  fields: definition.fields.filter((field) => field.key !== fieldKey),
  layout: { sections: withoutCol(definition.layout.sections, fieldKey) },
});

/** 改一個欄位的定義;改 key 時版面跟著改(公式等引用不改 —— 變成檢查器錯誤)。 */
export const updateField = (
  definition: FormDefinition,
  fieldKey: string,
  next: FieldDef,
): FormDefinition => ({
  ...definition,
  fields: definition.fields.map((field) =>
    field.key === fieldKey ? next : field,
  ),
  layout: {
    sections: definition.layout.sections.map((section) =>
      withSectionCols(
        section,
        sectionCols(section).map((col) =>
          col.fieldKey === fieldKey ? { ...col, fieldKey: next.key } : col,
        ),
      ),
    ),
  },
});

export const setFieldSpan = (
  definition: FormDefinition,
  fieldKey: string,
  span: number,
): FormDefinition => ({
  ...definition,
  layout: {
    sections: definition.layout.sections.map((section) =>
      withSectionCols(
        section,
        sectionCols(section).map((col) =>
          col.fieldKey === fieldKey ? { ...col, span } : col,
        ),
      ),
    ),
  },
});

export const spanOf = (
  definition: FormDefinition,
  fieldKey: string,
): number | null => colOf(definition.layout.sections, fieldKey)?.span ?? null;

export const addSection = (
  definition: FormDefinition,
  title: string,
): FormDefinition => ({
  ...definition,
  layout: {
    sections: [
      ...definition.layout.sections,
      {
        key: nextKey(
          "section",
          definition.layout.sections.map((section) => section.key),
        ),
        title,
        rows: [],
      },
    ],
  },
});

export const renameSection = (
  definition: FormDefinition,
  sectionKey: string,
  title: string,
): FormDefinition => ({
  ...definition,
  layout: {
    sections: definition.layout.sections.map((section) =>
      section.key === sectionKey ? { ...section, title } : section,
    ),
  },
});

/** 刪分區二選一:欄位移到「未放置」(`unplace`),或連同欄位刪除(`withFields`)。 */
export type RemoveSectionMode = "unplace" | "withFields";

export const removeSection = (
  definition: FormDefinition,
  sectionKey: string,
  mode: RemoveSectionMode,
): FormDefinition => {
  const section = definition.layout.sections.find(
    (candidate) => candidate.key === sectionKey,
  );
  if (section === undefined) {
    return definition;
  }
  const removed = new Set(sectionCols(section).map((col) => col.fieldKey));
  return {
    ...definition,
    fields:
      mode === "withFields"
        ? definition.fields.filter((field) => !removed.has(field.key))
        : definition.fields,
    layout: {
      sections: definition.layout.sections.filter(
        (candidate) => candidate.key !== sectionKey,
      ),
    },
  };
};

/** 還沒放進版面的欄位(`constant` 可以不放,不列)。 */
export const unplacedFields = (definition: FormDefinition): FieldDef[] => {
  const placed = new Set(layoutFieldKeys(definition.layout));
  return definition.fields.filter(
    (field) => !placed.has(field.key) && field.valueSource.kind !== "constant",
  );
};
