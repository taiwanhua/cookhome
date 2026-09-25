import { useState } from "react";
import { useTranslations } from "use-intl";

import { UploadPurpose, useCreateUploadUrlMutation } from "@repo/graphql";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";
import { UploadField } from "@repo/ui/upload-field";

import { useSession } from "@/hooks/useSession";
import { uploadNameOf } from "@/lib/form-engine/value-text";

import type { WidgetProps } from "./widget-types";

/** 與 api 的 `FORM_ATTACHMENT` 用途一致(檔型與上限同示範附件;正本 `createUploadUrl` 的說明)。 */
const ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
] as const;

const MAX_SIZE = 20 * 1024 * 1024;

/**
 * 上傳欄(`upload` → `upload`;ADR-0010 的三步:要簽名上傳票 → 瀏覽器直傳 bucket → 存
 * `{ path, name, size, contentType }`)。選了檔就上傳,存值換成新檔;按「移除」存 null。
 * 下載走 `formSubmissionAttachmentUrl`(詳情頁,看得到這一欄才簽)。
 */
export const UploadWidget = ({
  field,
  value,
  onChange,
  isDisabled,
  isDesign,
  helperText,
  hasError,
}: WidgetProps) => {
  const t = useTranslations("admin.formEngine.widgets");
  const { session } = useSession();
  const createUploadUrl = useCreateUploadUrlMutation(session.client);
  const [isUploading, setIsUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = uploadNameOf(value);

  const upload = async (file: File) => {
    setIsUploading(true);
    setFailed(false);
    try {
      const { createUploadUrl: ticket } = await createUploadUrl.mutateAsync({
        input: {
          purpose: UploadPurpose.FormAttachment,
          contentType: file.type,
          size: file.size,
        },
      });
      const response = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) {
        throw new Error(`Form upload failed: ${String(response.status)}`);
      }
      onChange({
        path: ticket.objectPath,
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
    } catch {
      setFailed(true);
    } finally {
      setIsUploading(false);
    }
  };

  const note = failed ? t("uploadFailed") : helperText;

  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" color="text.secondary">
        {field.label}
      </Typography>
      {name === "" ? (
        <UploadField
          accept={ACCEPT}
          maxSize={MAX_SIZE}
          isDisabled={isDisabled || isDesign || isUploading}
          hint={isUploading ? t("uploading") : t("uploadHint")}
          onChange={(file) => {
            if (file !== null) {
              void upload(file);
            }
          }}
        />
      ) : (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="body2">{name}</Typography>
          {!isDisabled && (
            <Button
              variant="text"
              size="small"
              color="error"
              onClick={() => {
                onChange(null);
              }}
            >
              {t("removeFile")}
            </Button>
          )}
        </Stack>
      )}
      {note !== undefined && (
        <Typography
          variant="caption"
          color={hasError || failed ? "error" : "text.secondary"}
        >
          {note}
        </Typography>
      )}
    </Stack>
  );
};
