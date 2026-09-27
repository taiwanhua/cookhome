import { useState } from "react";
import { useTranslations } from "use-intl";

import type {
  ExpressionContext,
  FormDefinition,
  StoredValues,
} from "@repo/domain/form";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";

import type { FieldPermissionFacts } from "@/lib/form-engine/field-states";
import type { FormError } from "@/lib/form-engine/form-errors";

import { FormRenderer } from "../FormRenderer/FormRenderer";
import { LookupDialog } from "../LookupDialog/LookupDialog";

export interface FormFillFormProps {
  definition: FormDefinition;
  formKey: string;
  version: number;
  initialValues: StoredValues;
  mode: "create" | "edit";
  permissions: FieldPermissionFacts;
  expressionContext: ExpressionContext;
  /** 草稿(或還沒建):存草稿 + 送出;已完成:只有「儲存修改」 */
  isCompleted: boolean;
  isPending: boolean;
  error: FormError | null;
  onSaveDraft: (values: StoredValues) => void;
  onSubmit: (values: StoredValues) => void;
  onCancel: () => void;
  /** 409 時的「重新載入」 */
  onReload: () => void;
}

/**
 * 新增 / 編輯的表單本體(Spec 6a §8 畫面 9):`FormRenderer` + 「帶入資料」(版本有帶入規則時)+
 * 存草稿 / 送出(一顆「送出」= 建 / 存草稿 + 送出;已完成的單只有「儲存修改」,修訂 +1)。
 *
 * 初始值由外層 gate 後帶進 `useState` 的初始化器(REACT-08);`values` 是整張表單的狀態,
 * 看不到的欄位原樣保留 `"[redacted]"` 送回(api 視為沒動)。
 */
export const FormFillForm = ({
  definition,
  formKey,
  version,
  initialValues,
  mode,
  permissions,
  expressionContext,
  isCompleted,
  isPending,
  error,
  onSaveDraft,
  onSubmit,
  onCancel,
  onReload,
}: FormFillFormProps) => {
  const t = useTranslations("admin.formEngine.fill");
  const tErrors = useTranslations("admin.formEngine.errors");
  const [values, setValues] = useState<StoredValues>(() => ({
    ...initialValues,
  }));
  const [isPrefilling, setIsPrefilling] = useState(false);
  const canPrefill = definition.prefills.length > 0;

  return (
    <Stack spacing={3}>
      {canPrefill && (
        <Stack direction="row">
          <Button
            variant="outlined"
            onClick={() => {
              setIsPrefilling(true);
            }}
          >
            {t("prefill")}
          </Button>
        </Stack>
      )}
      <FormRenderer
        version={definition}
        values={values}
        mode={mode}
        context={{ formKey, version }}
        expressionContext={expressionContext}
        permissions={permissions}
        onChange={setValues}
        fieldErrors={error?.fieldErrors ?? []}
      />
      {error !== null &&
        (error.code === "CONFLICT" ? (
          <Alert
            severity="warning"
            action={
              <Button variant="text" size="small" onClick={onReload}>
                {t("reload")}
              </Button>
            }
          >
            {tErrors("CONFLICT")}
          </Alert>
        ) : (
          <Alert severity="error">{tErrors(error.code)}</Alert>
        ))}
      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        <Button variant="text" onClick={onCancel}>
          {t("cancel")}
        </Button>
        {isCompleted ? (
          <Button
            disabled={isPending}
            onClick={() => {
              onSaveDraft(values);
            }}
          >
            {t("saveChanges")}
          </Button>
        ) : (
          <>
            <Button
              variant="outlined"
              disabled={isPending}
              onClick={() => {
                onSaveDraft(values);
              }}
            >
              {t("saveDraft")}
            </Button>
            <Button
              disabled={isPending}
              onClick={() => {
                onSubmit(values);
              }}
            >
              {t("submit")}
            </Button>
          </>
        )}
      </Stack>
      {isPrefilling && (
        <LookupDialog
          definition={definition}
          formKey={formKey}
          version={version}
          values={values}
          canEdit={permissions.canEdit}
          onApply={(patch) => {
            setValues((current) => ({ ...current, ...patch }));
            setIsPrefilling(false);
          }}
          onClose={() => {
            setIsPrefilling(false);
          }}
        />
      )}
    </Stack>
  );
};
