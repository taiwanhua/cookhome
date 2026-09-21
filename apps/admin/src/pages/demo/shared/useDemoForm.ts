import { useState } from "react";

import { type DemoError, demoErrorOf } from "./demo-error";
import type { DemoFormConfig, DemoItemLike } from "./demo-module-config";
import { useDemoUpload } from "./useDemoUpload";

/**
 * 一個上傳欄的狀態。三種情形要分得開,因為送給 api 的值不一樣(GQL-06):
 * - 選了新檔(`file`)→ 上傳後送新路徑
 * - 按了移除(`isCleared`)→ 送 `null`(清空)
 * - 都沒動 → 把原本的路徑原樣送回(= 不換檔)
 */
export interface FileSlot {
  file: File | null;
  isCleared: boolean;
}

export const emptyFileSlot: FileSlot = { file: null, isCleared: false };

export interface UseDemoFormOptions<Detail extends DemoItemLike, Values> {
  form: DemoFormConfig<Detail, Values>;
  /** 編輯的那一筆;新增頁為 null。**外層已經 gate 過**(資料到了才掛,REACT-08) */
  item: Detail | null;
  /** 儲存成功後(頁面自己決定導去哪) */
  onSaved: () => void;
}

export interface DemoFormState<Values> {
  values: Values;
  setValue: <Key extends keyof Values>(key: Key, value: Values[Key]) => void;
  /** 某個上傳欄現在的狀態(以 `DemoUpload.key` 取) */
  slotOf: (key: string) => FileSlot;
  setSlot: (key: string, slot: FileSlot) => void;
  /** 有沒有未儲存的變更(離開前的放棄變更確認看它) */
  isDirty: boolean;
  isSubmitting: boolean;
  error: DemoError | null;
  submit: () => void;
}

/** 選項欄的值是物件、每次都重建,所以比 `value` 而不是比參照。 */
const comparableOf = (input: unknown): unknown =>
  typeof input === "object" && input !== null && "value" in input
    ? input.value
    : input;

/** 文字 / 選項欄的淺比較。 */
const isSameValue = (a: unknown, b: unknown): boolean =>
  a === b || comparableOf(a) === comparableOf(b);

/**
 * 新增 / 編輯共用的表單狀態(Figma 175:558)。
 *
 * 初始值由 `config.form.toValues` 帶進 `useState` 的初始化器(REACT-08:不在 effect 內 setState);
 * 要先取單筆的編輯情境由**外層 gate** —— 資料到了才掛這個表單,所以這裡的 `item` 必然已就緒。
 *
 * 送出分兩段:先把每個上傳欄解析成一條路徑(選了新檔就上傳、按了移除送 null、沒動就把
 * 原路徑原樣送回),再把值與路徑交給設定物件的 `useSave` 轉成該模組的 input。
 */
export const useDemoForm = <Detail extends DemoItemLike, Values>({
  form,
  item,
  onSaved,
}: UseDemoFormOptions<Detail, Values>): DemoFormState<Values> => {
  const { upload, isUploading } = useDemoUpload();

  const [initialValues] = useState(() => form.toValues(item));
  const [values, setValues] = useState(initialValues);
  const [slots, setSlots] = useState<Partial<Record<string, FileSlot>>>({});
  const [error, setError] = useState<DemoError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = form.useSave({
    item,
    onSuccess: () => {
      setIsSaving(false);
      onSaved();
    },
    onError: (error_: unknown) => {
      setIsSaving(false);
      setError(demoErrorOf(error_));
    },
  });

  const slotOf = (key: string): FileSlot => slots[key] ?? emptyFileSlot;

  const valueEntries = Object.entries(initialValues as Record<string, unknown>);
  const isDirty =
    valueEntries.some(
      ([key, initial]) =>
        !isSameValue((values as Record<string, unknown>)[key], initial),
    ) ||
    form.uploads.some((definition) => {
      const slot = slotOf(definition.key);
      return slot.file !== null || slot.isCleared;
    });

  /** 一個上傳欄 → 要送給 api 的路徑。 */
  const pathOf = async (key: string): Promise<string | null> => {
    const definition = form.uploads.find((upload_) => upload_.key === key);
    if (definition === undefined) {
      return null;
    }
    const slot = slotOf(key);
    if (slot.file !== null) {
      return upload(slot.file, definition.purpose);
    }
    if (slot.isCleared || item === null) {
      return null;
    }
    return definition.pathOf(item);
  };

  const submit = () => {
    setError(null);
    setIsSaving(true);
    void (async () => {
      try {
        // 逐欄依序解析(封面 → 附件):兩欄同時換檔時,失敗的那一個要停在自己的錯誤上
        const paths: Record<string, string | null> = {};
        for (const definition of form.uploads) {
          paths[definition.key] = await pathOf(definition.key);
        }
        save.save(values, paths);
      } catch (error_: unknown) {
        setIsSaving(false);
        setError(demoErrorOf(error_));
      }
    })();
  };

  return {
    values,
    setValue: (key, value) => {
      setValues((current) => ({ ...current, [key]: value }));
    },
    slotOf,
    setSlot: (key, slot) => {
      setSlots((current) => ({ ...current, [key]: slot }));
    },
    isDirty,
    isSubmitting: isSaving || isUploading,
    error,
    submit,
  };
};
