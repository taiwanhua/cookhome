import type { FieldDef } from "@repo/domain/form";
import { useFormFieldOptionsQuery, useFormLookupQuery } from "@repo/graphql";

import { useSession } from "@/hooks/useSession";

import type { ChoiceOption, WidgetContext } from "./widget-types";

/** lookup 選項一次取幾筆(搜尋交給 api,`formLookup` 的 keyword)。 */
const LOOKUP_PAGE_SIZE = 50;

/** 類別選項一次取完(字典型的短清單,`formFieldOptions` 的上限),搜尋在前端比對。 */
const CATEGORY_PAGE_SIZE = 100;

export interface FieldOptions {
  options: readonly ChoiceOption[];
  isLoading: boolean;
  /** 選項拿不到(類別選項的查詢失敗):只顯示既有值、改不了。 */
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
 * - 欄位管理類別:打 `formFieldOptions`(只帶「哪個版本的哪個欄位」,類別 key 由 api 從定義取;
 *   合併範圍、只回啟用的);存 `{ value, label }`。不需要欄位管理的權限
 * - lookup 來源:打 `formLookup`(只帶「哪個版本的哪個欄位」+ 關鍵字,provider / filter 由 api 從定義取)
 */
export const useFieldOptions = ({
  field,
  context,
  keyword,
  isDesign,
}: UseFieldOptionsInput): FieldOptions => {
  const { session } = useSession();
  const source = field.options ?? null;

  const categoryOptions = useFormFieldOptionsQuery(
    session.client,
    {
      input: {
        formKey: context.formKey,
        ...(context.version !== null && { version: context.version }),
        fieldKey: field.key,
        page: 1,
        pageSize: CATEGORY_PAGE_SIZE,
      },
    },
    { enabled: !isDesign && source?.kind === "fieldCategory" },
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
        options: (categoryOptions.data?.formFieldOptions.items ?? []).map(
          (item) => ({
            value: item.value,
            label: item.label,
            stored: { value: item.value, label: item.label },
          }),
        ),
        isLoading: categoryOptions.isLoading,
        isUnavailable: !isDesign && categoryOptions.isError,
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
