import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { UploadPurpose } from "@repo/graphql";

import { useSession } from "@/hooks/useSession";

import {
  SAMPLE_ONE_QUERIES,
  SAMPLE_ONE_UPLOAD,
} from "../demo-sample-one-config";
import {
  type SampleOneError,
  sampleOneErrorOf,
} from "../demo-sample-one-error";
import type {
  DemoCategoryOption,
  DemoItemDetail,
  InternalNoteMode,
} from "../demo-sample-one-types";
import {
  type FileSlot,
  type SampleOneFormValues,
  emptyFileSlot,
  toCreateInput,
  toFormValues,
  toUpdateInput,
} from "./sample-one-form";
import { useDemoUpload } from "./useDemoUpload";

// 模組層解構:具名 hook 呼叫(設定物件見 `demo-sample-one-config.ts`)
const { useCreate, useUpdate, useItem } = SAMPLE_ONE_QUERIES;

export interface UseSampleOneFormOptions {
  /** 編輯的那一筆;新增頁為 null */
  item: DemoItemDetail | null;
  categoryOptions: readonly DemoCategoryOption[];
  internalNoteMode: InternalNoteMode;
  /** 儲存成功後(頁面自己決定導去哪) */
  onSaved: () => void;
}

export interface SampleOneFormState {
  values: SampleOneFormValues;
  setValue: <Key extends keyof SampleOneFormValues>(
    key: Key,
    value: SampleOneFormValues[Key],
  ) => void;
  cover: FileSlot;
  setCover: (slot: FileSlot) => void;
  attachment: FileSlot;
  setAttachment: (slot: FileSlot) => void;
  /** 有沒有未儲存的變更(離開前的放棄變更確認看它) */
  isDirty: boolean;
  isSubmitting: boolean;
  error: SampleOneError | null;
  submit: () => void;
}

/**
 * 新增 / 編輯共用的表單狀態(Figma 175:558)。
 *
 * 初始值由 props 帶進 `useState` 的初始化器(REACT-08:不在 effect 內 setState);
 * 要先取單筆的編輯情境由**外層 gate** —— 資料到了才掛這個表單元件,所以這裡的 `item` 必然已就緒。
 */
export const useSampleOneForm = ({
  item,
  categoryOptions,
  internalNoteMode,
  onSaved,
}: UseSampleOneFormOptions): SampleOneFormState => {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { upload, isUploading } = useDemoUpload();

  const [initialValues] = useState(() => toFormValues(item, categoryOptions));
  const [values, setValues] = useState(initialValues);
  const [cover, setCover] = useState<FileSlot>(emptyFileSlot);
  const [attachment, setAttachment] = useState<FileSlot>(emptyFileSlot);
  const [error, setError] = useState<SampleOneError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onError = (caught: unknown) => {
    setIsSaving(false);
    setError(sampleOneErrorOf(caught));
  };
  const onSuccess = async () => {
    setIsSaving(false);
    if (item !== null) {
      await queryClient.invalidateQueries({
        queryKey: useItem.getKey({ id: item.id }),
      });
    }
    onSaved();
  };

  const create = useCreate(session.client, {
    onSuccess: () => {
      void onSuccess();
    },
    onError,
  });
  const update = useUpdate(session.client, {
    onSuccess: () => {
      void onSuccess();
    },
    onError,
  });

  const setValue = <Key extends keyof SampleOneFormValues>(
    key: Key,
    value: SampleOneFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const isDirty =
    values.name !== initialValues.name ||
    values.note !== initialValues.note ||
    values.internalNote !== initialValues.internalNote ||
    values.status !== initialValues.status ||
    (values.category?.value ?? null) !==
      (initialValues.category?.value ?? null) ||
    cover.file !== null ||
    cover.isCleared ||
    attachment.file !== null ||
    attachment.isCleared;

  /** 檔案欄 → 要送給 api 的路徑:選了新檔就上傳、按了移除送 null、都沒動就把原路徑送回。 */
  const pathOf = async (
    slot: FileSlot,
    purpose: UploadPurpose,
    currentPath: string | null,
  ): Promise<string | null> => {
    if (slot.file !== null) {
      return upload(slot.file, purpose);
    }
    return slot.isCleared ? null : currentPath;
  };

  const submit = () => {
    setError(null);
    setIsSaving(true);
    void (async () => {
      try {
        const coverPath = await pathOf(
          cover,
          SAMPLE_ONE_UPLOAD.cover.purpose,
          item?.coverPath ?? null,
        );
        const attachmentPath = await pathOf(
          attachment,
          SAMPLE_ONE_UPLOAD.attachment.purpose,
          item?.attachment?.path ?? null,
        );
        const input = { values, internalNoteMode, coverPath, attachmentPath };
        if (item === null) {
          create.mutate({ input: toCreateInput(input) });
        } else {
          update.mutate({ input: toUpdateInput(item.id, input) });
        }
      } catch (error_: unknown) {
        onError(error_);
      }
    })();
  };

  return {
    values,
    setValue,
    cover,
    setCover,
    attachment,
    setAttachment,
    isDirty,
    isSubmitting: isSaving || isUploading,
    error,
    submit,
  };
};
