import type { FieldDef } from "@repo/domain/form";
import {
  useFieldCategoriesQuery,
  useFieldsQuery,
  useFormLookupQuery,
} from "@repo/graphql";

import { usePermissions } from "@/hooks/usePermissions";
import { useSession } from "@/hooks/useSession";

import type { ChoiceOption, WidgetContext } from "./widget-types";

/** 欄位管理類別的選項掛在這把權限底下(api 正本 `fields.resolver.ts`)。 */
const FIELD_MANAGER_VIEW = "system.field-manager.view";

/** lookup 選項一次取幾筆(搜尋交給 api,`formLookup` 的 keyword)。 */
const LOOKUP_PAGE_SIZE = 50;

export interface FieldOptions {
  options: readonly ChoiceOption[];
  isLoading: boolean;
  /**
   * 選項拿不到:類別選項要 `system.field-manager.view`(填寫端沒有專屬的類別選項端點),
   * 沒有這把權限的人只看得到既有值、改不了 —— 與示範模組1 的分類欄同一個退路。
   */
  isUnavailable: boolean;
}

export interface UseFieldOptionsInput {
  field: FieldDef;
  context: WidgetContext;
  /** lookup 選項的搜尋字(送給 api);靜態 / 類別選項在前端比對 */
  keyword: string;
  /** 設計模式不查任何選項 */
  isDesign: boolean;
}

/**
 * 選項欄三種來源(Spec 6a §5「`options` 三種來源」)統一成 `ChoiceOption[]`:
 * - 靜態清單:定義裡的 items,停用的不列、依 `order` 排
 * - 欄位管理類別:合併範圍的當前選項,停用的不列;存 `{ value, label }`
 * - lookup 來源:打 `formLookup`(只帶「哪個版本的哪個欄位」+ 關鍵字,provider / filter 由 api 從定義取)
 */
export const useFieldOptions = ({
  field,
  context,
  keyword,
  isDesign,
}: UseFieldOptionsInput): FieldOptions => {
  const { session } = useSession();
  const { hasPermission } = usePermissions();
  const source = field.options ?? null;
  const categoryKey = source?.kind === "fieldCategory" ? source.key : null;
  const canReadCategories = hasPermission(FIELD_MANAGER_VIEW);

  const categories = useFieldCategoriesQuery(session.client, undefined, {
    enabled: !isDesign && categoryKey !== null && canReadCategories,
  });
  const categoryId =
    categories.data?.fieldCategories.items.find(
      (category) => category.key === categoryKey,
    )?.id ?? null;
  const categoryFields = useFieldsQuery(
    session.client,
    { categoryId: categoryId ?? "" },
    { enabled: !isDesign && categoryId !== null },
  );

  const lookup = useFormLookupQuery(
    session.client,
    {
      input: {
        formKey: context.formKey,
        ...(context.version !== null && { version: context.version }),
        target: { fieldKey: field.key },
        keyword,
        page: 1,
        pageSize: LOOKUP_PAGE_SIZE,
      },
    },
    { enabled: !isDesign && source?.kind === "lookup" },
  );

  if (source === null) {
    return { options: [], isLoading: false, isUnavailable: false };
  }
  switch (source.kind) {
    case "static": {
      return {
        options: source.items
          .filter((item) => item.enabled)
          .toSorted((a, b) => a.order - b.order)
          .map((item) => ({
            value: item.value,
            label: item.label,
            stored: item.value,
          })),
        isLoading: false,
        isUnavailable: false,
      };
    }
    case "fieldCategory": {
      return {
        options: (categoryFields.data?.fields.items ?? [])
          .filter((item) => item.enabled)
          .map((item) => ({
            value: item.value,
            label: item.label,
            stored: { value: item.value, label: item.label },
          })),
        isLoading: categories.isLoading || categoryFields.isLoading,
        isUnavailable: !isDesign && !canReadCategories,
      };
    }
    case "lookup": {
      return {
        options: (lookup.data?.formLookup.items ?? []).map((record) => {
          const value = record.value ?? record.id;
          const label = record.label ?? value;
          return { value, label, stored: { value, label } };
        }),
        isLoading: lookup.isLoading,
        isUnavailable: false,
      };
    }
  }
};
