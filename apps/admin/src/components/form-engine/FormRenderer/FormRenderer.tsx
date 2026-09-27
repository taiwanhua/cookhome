import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { type ReactNode, useMemo } from "react";

import {
  type ExpressionContext,
  type FieldDef,
  type FormDefinition,
  type LayoutSection,
  type StoredValues,
  fieldProtections,
} from "@repo/domain/form";
import { Box } from "@repo/ui/box";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { fieldMapOf } from "@/lib/form-engine/definition";
import { designFieldId } from "@/lib/form-engine/design-ids";
import {
  type FieldPermissionFacts,
  type FormRendererMode,
  OPEN_PERMISSIONS,
  type ServerFormState,
  resolveFormState,
} from "@/lib/form-engine/field-states";
import type { FormFieldErrorLike } from "@/lib/form-engine/form-errors";
import type { FormDisplayItemLike } from "@/lib/form-engine/value-text";

import type { WidgetContext } from "../widgets/widget-types";
import { DesignFieldCell } from "./DesignFieldCell";
import { FormFieldCell } from "./FormFieldCell";
import { SectionDropZone } from "./SectionDropZone";
import { cellSpanSx, sectionGridSx } from "./layout-grid";

export interface FormRendererDesignProps {
  selectedFieldKey: string | null;
  onSelectField: (fieldKey: string) => void;
  /** 分區標題旁的操作(設計器:改名、刪分區) */
  renderSectionActions?: (section: LayoutSection) => ReactNode;
}

export interface FormRendererProps {
  /** 這一版的定義(`form_versions` 的四塊) */
  version: FormDefinition;
  /** 存值形狀的值(新增是空物件;編輯 / 詳情是那一筆的 `values`,受保護且無權的是 `"[redacted]"`) */
  values: StoredValues;
  mode: FormRendererMode;
  /** widget 的 lookup 要知道查哪張表單哪一版(預覽是草稿:version null) */
  context: WidgetContext;
  /** 表達式的 `ctx`:填寫 = 現在 + 填寫者;唯讀 = 該修訂的 `ctx`(不拿讀者補值) */
  expressionContext: ExpressionContext;
  /** 欄位級權限;不給 = 不套(設計、預覽) */
  permissions?: FieldPermissionFacts;
  onChange?: (values: StoredValues) => void;
  fieldErrors?: readonly FormFieldErrorLike[];
  displayValues?: readonly {
    fieldKey: string;
    items: readonly FormDisplayItemLike[];
  }[];
  onDownload?: (field: FieldDef) => void;
  /** 後端算的值與狀態(預覽「以後端重算」之後);有就以後端為準 */
  serverState?: ServerFormState | null;
  /** 設計模式的選取(畫布由設計器包 `DndContext`) */
  design?: FormRendererDesignProps;
}

/**
 * 依版本畫表單(Spec 6a §8 `<FormRenderer version values mode>`)。五種 `mode` 的語意在
 * `lib/form-engine/field-states.ts`;版面 12 格制見 `layout-grid.ts`。
 *
 * 欄位級三態:讀者沒有 show → 整格不渲染(不是顯示空值);有 show 沒有 edit → 唯讀並附說明;
 * 都有 → 可填。`visibleWhen` 算出 false 的也不渲染;計算欄位缺依賴時顯示「—」。
 */
export const FormRenderer = ({
  version,
  values,
  mode,
  context,
  expressionContext,
  permissions = OPEN_PERMISSIONS,
  onChange,
  fieldErrors = [],
  displayValues = [],
  onDownload,
  serverState = null,
  design,
}: FormRendererProps) => {
  const byKey = useMemo(() => fieldMapOf(version.fields), [version.fields]);
  const protections = useMemo(
    () => fieldProtections(version.fields),
    [version.fields],
  );
  const resolved = useMemo(
    () =>
      resolveFormState({
        definition: version,
        values,
        ctx: expressionContext,
        mode,
        permissions,
        serverState,
      }),
    [version, values, expressionContext, mode, permissions, serverState],
  );

  const handleChange = (fieldKey: string, value: unknown) => {
    onChange?.({ ...values, [fieldKey]: value });
  };

  const isDesign = mode === "design";

  return (
    <Stack spacing={3}>
      {version.layout.sections.map((section) => {
        const cols = section.rows
          .flatMap((row) => row.cols)
          .filter((col) => byKey.has(col.fieldKey));
        const cells = cols.flatMap((col) => {
          const field = byKey.get(col.fieldKey);
          const state = resolved.states.get(col.fieldKey);
          if (field === undefined || state?.visible !== true) {
            return [];
          }
          const cell = (
            <FormFieldCell
              field={field}
              state={state}
              value={resolved.values[field.key] ?? null}
              mode={mode}
              context={context}
              onChange={handleChange}
              errorMessage={
                fieldErrors.find((error) => error.fieldKey === field.key)
                  ?.message ?? null
              }
              {...(onDownload !== undefined && { onDownload })}
              display={
                displayValues.find((entry) => entry.fieldKey === field.key)
                  ?.items ?? []
              }
            />
          );
          return [
            <Box key={field.key} sx={cellSpanSx(col.span)}>
              {isDesign && design !== undefined ? (
                <DesignFieldCell
                  field={field}
                  protection={protections.get(field.key)}
                  labelOf={(key) => byKey.get(key)?.label ?? key}
                  isSelected={design.selectedFieldKey === field.key}
                  onSelect={design.onSelectField}
                >
                  {cell}
                </DesignFieldCell>
              ) : (
                cell
              )}
            </Box>,
          ];
        });

        return (
          <Stack
            key={section.key}
            component="section"
            spacing={1.5}
            aria-label={section.title}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="subtitle1" component="h2" sx={{ flex: 1 }}>
                {section.title}
              </Typography>
              {isDesign && design?.renderSectionActions?.(section)}
            </Stack>
            {isDesign ? (
              <SortableContext
                items={cols.map((col) => designFieldId(col.fieldKey))}
                strategy={rectSortingStrategy}
              >
                <Box sx={sectionGridSx}>
                  {cells}
                  <SectionDropZone sectionKey={section.key} />
                </Box>
              </SortableContext>
            ) : (
              <Box sx={sectionGridSx}>{cells}</Box>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
};
