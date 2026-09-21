import {
  type CreateDemoItemOneInput,
  DemoItemOneStatus,
  type UpdateDemoItemOneInput,
} from "@repo/graphql";

import type {
  DemoCategoryOption,
  DemoItemDetail,
  InternalNoteMode,
} from "../demo-sample-one-types";

/** 表單的文字 / 選擇類欄位(檔案欄另外記,見 `FileSlot`)。 */
export interface SampleOneFormValues {
  name: string;
  category: DemoCategoryOption | null;
  status: DemoItemOneStatus;
  note: string;
  internalNote: string;
}

/**
 * 一個檔案欄的狀態。三種情形要分得開,因為送給 api 的值不一樣(GQL-06):
 * - 選了新檔(`file`)→ 上傳後送新路徑
 * - 按了移除(`isCleared`)→ 送 `null`(清空)
 * - 都沒動 → 把原本的路徑原樣送回(= 不換檔)
 */
export interface FileSlot {
  file: File | null;
  isCleared: boolean;
}

export const emptyFileSlot: FileSlot = { file: null, isCleared: false };

/** 編輯情境的初始值;新增情境傳 `null`。 */
export const toFormValues = (
  item: DemoItemDetail | null,
  categoryOptions: readonly DemoCategoryOption[],
): SampleOneFormValues => {
  if (item === null) {
    return {
      name: "",
      category: null,
      status: DemoItemOneStatus.Draft,
      note: "",
      internalNote: "",
    };
  }
  const category = item.category ?? null;
  return {
    name: item.name,
    // 選項清單拿不到(沒有欄位管理檢視權限)或該選項已停用時,仍用 api 給的顯示名撐住這一格
    category:
      category === null
        ? null
        : (categoryOptions.find((option) => option.value === category) ?? {
            value: category,
            label: item.categoryLabel ?? category,
          }),
    status: item.status,
    note: item.note ?? "",
    internalNote: item.internalNote ?? "",
  };
};

/** 內部備註欄的三態(模組文件的欄位級權限示範)。 */
export const internalNoteModeOf = (
  canShow: boolean,
  canEdit: boolean,
): InternalNoteMode => {
  if (!canShow) {
    return "hidden";
  }
  return canEdit ? "editable" : "readonly";
};

/** 空字串 → `null`(api 的「沒填」是 null,不是空字串)。 */
const orNull = (value: string): string | null =>
  value.trim() === "" ? null : value.trim();

export interface BuildInputOptions {
  values: SampleOneFormValues;
  internalNoteMode: InternalNoteMode;
  /** 上傳後的封面路徑;不換檔時是原本的路徑,清空時是 null */
  coverPath: string | null;
  attachmentPath: string | null;
}

/**
 * 表單 → `createDemoItemOne` 的 input。
 *
 * **`internalNote` 只在可改時才放進 input**:模組文件寫得很清楚 —— 這個欄位**一出現就要權限**,
 * 連送 `null` 清空都會被 `FORBIDDEN` + `FIELD_FORBIDDEN` 擋下。唯讀 / 不顯示時整個鍵都不能出現。
 */
export const toCreateInput = ({
  values,
  internalNoteMode,
  coverPath,
  attachmentPath,
}: BuildInputOptions): CreateDemoItemOneInput => ({
  name: values.name.trim(),
  status: values.status,
  category: values.category?.value ?? null,
  note: orNull(values.note),
  coverPath,
  attachmentPath,
  ...(internalNoteMode === "editable"
    ? { internalNote: orNull(values.internalNote) }
    : {}),
});

/**
 * 表單 → `updateDemoItemOne` 的 input。缺席 = 不動、`null` = 清空(GQL-06),
 * 所以每個欄位都明確送值:封面 / 附件「不換檔」就是把原本的路徑原樣送回。
 */
export const toUpdateInput = (
  id: string,
  options: BuildInputOptions,
): UpdateDemoItemOneInput => ({ id, ...toCreateInput(options) });
