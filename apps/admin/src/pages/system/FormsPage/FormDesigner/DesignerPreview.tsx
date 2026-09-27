import { useState } from "react";
import { useTranslations } from "use-intl";

import type { FormDefinition, StoredValues } from "@repo/domain/form";
import {
  type PreviewFormVersionQuery,
  usePreviewFormVersionQuery,
} from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { FormRenderer } from "@/components/form-engine/FormRenderer/FormRenderer";
import { LookupDialog } from "@/components/form-engine/LookupDialog/LookupDialog";
import { useMe } from "@/hooks/useMe";
import { useSession } from "@/hooks/useSession";
import { liveContextOf } from "@/lib/form-engine/expression-context";
import { formErrorOf } from "@/lib/form-engine/form-errors";

export interface DesignerPreviewProps {
  formKey: string;
  definition: FormDefinition;
  /** 草稿有未存的變更:後端預覽算的是已存的那一份 */
  isDirty: boolean;
  /** 唯讀檢視已發布 / 已退役的版本時是它的版號;草稿為 null(只有草稿能「以後端重算」) */
  version?: number | null;
}

type PreviewResult = PreviewFormVersionQuery["previewFormVersion"];

/**
 * 預覽模式(Spec 6a §8「設計模式 vs 預覽」):`FormRenderer` 的 `preview` 模式 —— 條件與計算前端即時跑、
 * 不套欄位級權限、輸入測試值、不建提交;「以後端重算」打 `previewFormVersion` 對**已存的草稿**算一次
 * (以後端為準:摘要槽、值錯誤)。
 */
export const DesignerPreview = ({
  formKey,
  definition,
  isDirty,
  version = null,
}: DesignerPreviewProps) => {
  const t = useTranslations("admin.forms.preview");
  const tErrors = useTranslations("admin.forms.errors");
  const { session } = useSession();
  const me = useMe();
  const [values, setValues] = useState<StoredValues>({});
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [now] = useState(() => new Date());
  const user = me.data?.me;

  const runOnServer = async () => {
    setIsRunning(true);
    setFailure(null);
    try {
      const payload = await usePreviewFormVersionQuery.fetcher(session.client, {
        input: { formKey, values },
      })();
      setResult(payload.previewFormVersion);
    } catch (error_) {
      setFailure(tErrors(formErrorOf(error_).code));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Stack spacing={2} component="section" aria-label={t("region")}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {isDirty ? t("dirtyHint") : t("hint")}
        </Typography>
        {definition.prefills.length > 0 && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setIsPrefilling(true);
            }}
          >
            {t("prefill")}
          </Button>
        )}
        {version === null && (
          <Button
            size="small"
            disabled={isRunning}
            onClick={() => {
              void runOnServer();
            }}
          >
            {t("runOnServer")}
          </Button>
        )}
      </Stack>
      <FormRenderer
        version={definition}
        values={values}
        mode="preview"
        context={{ formKey, version }}
        expressionContext={liveContextOf(
          user?.id ?? null,
          user?.currentOrg?.id ?? null,
          now,
        )}
        onChange={(next) => {
          // 改了測試值,後端上一輪的結果就過期了:回到前端即時算,等下一次「以後端重算」
          setValues(next);
          setResult(null);
        }}
        serverState={result}
        fieldErrors={result?.fieldErrors ?? []}
      />
      {failure !== null && <Alert severity="error">{failure}</Alert>}
      {result !== null && (
        <Alert
          severity={result.fieldErrors.length === 0 ? "success" : "warning"}
        >
          {t("serverSummary", {
            title: result.summary.title ?? "—",
            date: result.summary.date ?? "—",
            amount: result.summary.amount ?? "—",
            errors: result.fieldErrors.length,
          })}
        </Alert>
      )}
      {isPrefilling && (
        <LookupDialog
          definition={definition}
          formKey={formKey}
          version={version}
          values={values}
          canEdit={() => true}
          onApply={(patch) => {
            setValues((current) => ({ ...current, ...patch }));
            setResult(null);
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
