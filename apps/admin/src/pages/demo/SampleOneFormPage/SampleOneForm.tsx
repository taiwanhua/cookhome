import { useState } from "react";
import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Autocomplete } from "@repo/ui/autocomplete";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { MenuItem } from "@repo/ui/menu";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { UploadField } from "@repo/ui/upload-field";

import { DiscardChangesDialog } from "../DiscardChangesDialog";
import {
  SAMPLE_ONE_I18N,
  SAMPLE_ONE_STATUSES,
  SAMPLE_ONE_UPLOAD,
} from "../demo-sample-one-config";
import { hasFieldError } from "../demo-sample-one-error";
import type {
  DemoCategoryOption,
  DemoItemDetail,
  InternalNoteMode,
} from "../demo-sample-one-types";
import { useUnsavedGuard } from "../useUnsavedGuard";
import { FormTipsBlock } from "./FormTipsBlock";
import { ItemHistoryBlock } from "./ItemHistoryBlock";
import { useSampleOneForm } from "./useSampleOneForm";

export interface SampleOneFormProps {
  /** 編輯的那一筆;新增為 null。**外層已經 gate 過**(資料到了才掛這個元件,REACT-08) */
  item: DemoItemDetail | null;
  categoryOptions: readonly DemoCategoryOption[];
  /** 分類選項拿不拿得到(需要欄位管理檢視權限) */
  isCategoryAvailable: boolean;
  internalNoteMode: InternalNoteMode;
  /** 新增頁 + 持有 `create-page.show-tips` */
  showTips: boolean;
  /** 編輯頁 + 持有 `edit-page.show-history` */
  showHistory: boolean;
  /** 離開這一頁(取消、或儲存完成);有未儲存的變更時會先跳放棄變更確認 */
  onLeave: () => void;
}

/**
 * 新增 / 編輯共版型的表單本體(Figma 177:554)。同一份版型兩種情境,差異只有三處:
 * 標題、填寫提示區塊(新增)、變更歷程區塊(編輯)。
 *
 * 內部備註三態由 `internalNoteMode` 驅動(`hidden` 連渲染都沒有,`readonly` 是唯讀);
 * 封面走公開 bucket、附件走私有 bucket,兩個都是 `UploadField` + 送出時才上傳(ADR-0010)。
 *
 * 表單狀態的初始值只在掛載時取一次,所以這個元件由外層 gate 之後才掛(REACT-08)。
 */
export const SampleOneForm = ({
  item,
  categoryOptions,
  isCategoryAvailable,
  internalNoteMode,
  showTips,
  showHistory,
  onLeave,
}: SampleOneFormProps) => {
  const t = useTranslations(`${SAMPLE_ONE_I18N}.form`);
  const tStatus = useTranslations(`${SAMPLE_ONE_I18N}.status`);
  const tFields = useTranslations(`${SAMPLE_ONE_I18N}.fields`);
  const tErrors = useTranslations(`${SAMPLE_ONE_I18N}.errors`);

  const [isDiscarding, setIsDiscarding] = useState(false);
  const form = useSampleOneForm({
    item,
    categoryOptions,
    internalNoteMode,
    onSaved: onLeave,
  });
  useUnsavedGuard(form.isDirty);

  /** 取消:改過才問一次,沒改過就直接走(問一個「要放棄什麼」根本沒東西可放棄的問題很煩)。 */
  const handleCancel = () => {
    if (form.isDirty) {
      setIsDiscarding(true);
      return;
    }
    onLeave();
  };

  const { error } = form;
  /** 欄位級的錯誤標在欄位上,其餘(FORBIDDEN / NOT_FOUND / 未知)才在底部用 Alert 講 */
  const fieldHelper = (field: string) =>
    hasFieldError(error, field) ? tErrors(`fields.${field}`) : undefined;
  /** 欄位級的錯誤已經標在欄位上,不必再來一條橫幅;其餘的錯誤才用 Alert 講 */
  const hasBannerError =
    error !== null &&
    (error.fields.length === 0 || error.code !== "VALIDATION_FAILED");
  const bannerCode = error?.code ?? "UNEXPECTED";

  return (
    <Stack spacing={2.25}>
      <Stack spacing={0.25}>
        <Box component="h1" sx={{ typography: "subtitle1", m: 0 }}>
          {item === null
            ? t("createTitle")
            : t("editTitle", { name: item.name })}
        </Box>
      </Stack>

      {showTips && <FormTipsBlock />}

      <TextField
        label={tFields("name")}
        required
        size="small"
        value={form.values.name}
        error={hasFieldError(error, "name")}
        helperText={fieldHelper("name")}
        sx={{ width: 360 }}
        onChange={(event) => {
          form.setValue("name", event.target.value);
        }}
      />

      {isCategoryAvailable ? (
        <Autocomplete<DemoCategoryOption>
          options={categoryOptions}
          value={form.values.category}
          onChange={(value) => {
            form.setValue("category", value);
          }}
          getOptionLabel={(option) => option.label}
          getOptionKey={(option) => option.value}
          label={tFields("category")}
          error={hasFieldError(error, "category")}
          helperText={fieldHelper("category")}
          sx={{ width: 240 }}
        />
      ) : (
        // 沒有欄位管理的檢視權限就拿不到選項:保留原值、改不動,並講明原因
        <TextField
          label={tFields("category")}
          size="small"
          value={form.values.category?.label ?? ""}
          disabled
          helperText={t("categoryUnavailable")}
          sx={{ width: 240 }}
        />
      )}

      <TextField
        select
        label={tFields("status")}
        size="small"
        value={form.values.status}
        sx={{ width: 240 }}
        onChange={(event) => {
          form.setValue(
            "status",
            event.target.value as (typeof SAMPLE_ONE_STATUSES)[number],
          );
        }}
      >
        {SAMPLE_ONE_STATUSES.map((status) => (
          <MenuItem key={status} value={status}>
            {tStatus(status)}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label={tFields("note")}
        size="small"
        multiline
        minRows={2}
        value={form.values.note}
        sx={{ width: 480 }}
        onChange={(event) => {
          form.setValue("note", event.target.value);
        }}
      />

      {/* 欄位級權限的示範:沒有 `show-internal-note` 時整欄不渲染,有檢視無編輯時唯讀 */}
      {internalNoteMode !== "hidden" && (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <TextField
            label={tFields("internalNote")}
            size="small"
            multiline
            minRows={2}
            value={form.values.internalNote}
            disabled={internalNoteMode === "readonly"}
            error={hasFieldError(error, "internalNote")}
            helperText={fieldHelper("internalNote")}
            sx={{ width: 480 }}
            onChange={(event) => {
              form.setValue("internalNote", event.target.value);
            }}
          />
          {internalNoteMode === "readonly" && (
            <Box sx={{ typography: "caption", color: "text.secondary" }}>
              {t("internalNoteReadonly")}
            </Box>
          )}
        </Stack>
      )}

      <Stack direction="row" spacing={2.5} sx={{ alignItems: "flex-start" }}>
        <UploadField
          label={tFields("cover")}
          hint={t("coverHint")}
          value={form.cover.file}
          initialPreviewUrl={form.cover.isCleared ? null : item?.coverUrl}
          initialPreviewLabel={t("coverCurrent")}
          accept={SAMPLE_ONE_UPLOAD.cover.accept}
          maxSize={SAMPLE_ONE_UPLOAD.cover.maxSize}
          sx={{ width: 340 }}
          onChange={(file) => {
            form.setCover({ file, isCleared: file === null });
          }}
        />
        <Stack spacing={0.75} sx={{ width: 340 }}>
          {/* 附件在私有 bucket、沒有可預覽的網址,所以既有檔案獨立一行顯示檔名 + 移除 */}
          {item?.attachment != null && !form.attachment.isCleared && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box sx={{ typography: "body2", flex: 1, minWidth: 0 }}>
                {t("attachmentCurrent", { name: item.attachment.name })}
              </Box>
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  form.setAttachment({ file: null, isCleared: true });
                }}
              >
                {t("removeAttachment")}
              </Button>
            </Stack>
          )}
          <UploadField
            label={tFields("attachment")}
            hint={t("attachmentHint")}
            value={form.attachment.file}
            accept={SAMPLE_ONE_UPLOAD.attachment.accept}
            maxSize={SAMPLE_ONE_UPLOAD.attachment.maxSize}
            onChange={(file) => {
              form.setAttachment({
                file,
                isCleared: file === null && form.attachment.isCleared,
              });
            }}
          />
        </Stack>
      </Stack>

      {showHistory && item !== null && <ItemHistoryBlock itemId={item.id} />}

      {hasBannerError && <Alert severity="error">{tErrors(bannerCode)}</Alert>}

      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Box sx={{ flex: 1 }} />
        <Button variant="text" onClick={handleCancel}>
          {t("cancel")}
        </Button>
        <Button disabled={form.isSubmitting} onClick={form.submit}>
          {t("save")}
        </Button>
      </Stack>

      {isDiscarding && (
        <DiscardChangesDialog
          onCancel={() => {
            setIsDiscarding(false);
          }}
          onConfirm={onLeave}
        />
      )}
    </Stack>
  );
};
