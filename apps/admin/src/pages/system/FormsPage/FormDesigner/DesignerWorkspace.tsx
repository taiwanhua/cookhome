import { useState } from "react";
import { useTranslations } from "use-intl";

import type {
  DefinitionIssue,
  FieldType,
  LayoutSection,
} from "@repo/domain/form";
import {
  type FormFieldsFragment,
  type FormVersionFieldsFragment,
  useModuleListColumnsQuery,
  useSaveFormVersionDraftMutation,
} from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { Tabs } from "@repo/ui/tabs";
import { Typography } from "@repo/ui/typography";

import { useMutationFeedback } from "@/hooks/useMutationFeedback";
import { useSession } from "@/hooks/useSession";
import { definitionOf, rawOf } from "@/lib/form-engine/definition";
import { spanOf } from "@/lib/form-engine/designer-ops";
import { fieldReferences } from "@/lib/form-engine/field-references";
import { type FormError, formErrorOf } from "@/lib/form-engine/form-errors";

import { ComponentPalette } from "./ComponentPalette";
import { DeleteFieldDialog } from "./DeleteFieldDialog";
import { DeleteSectionDialog } from "./DeleteSectionDialog";
import { DesignerCanvas } from "./DesignerCanvas";
import { DesignerPreview } from "./DesignerPreview";
import { FormSettingsPanel } from "./FormSettingsPanel/FormSettingsPanel";
import { IssueList } from "./IssueList";
import { JsonPreview } from "./JsonPreview";
import { FieldPropertyPanel } from "./PropertyPanel/FieldPropertyPanel";
import { useDesignerState } from "./useDesignerState";

export interface DesignerWorkspaceProps {
  form: FormFieldsFragment;
  draft: FormVersionFieldsFragment;
  onSaved: () => void;
  onReload: () => void;
}

type DesignerMode = "design" | "preview";

/**
 * 設計器本體(Spec 6a §8 畫面 2):元件面板 / 畫布 / 屬性面板 / JSON 預覽 / 檢查結果;「預覽」切到 `preview` 模式。
 * 存草稿帶 `expectedDraftRevision`(= 讀到或上次存完的 `draftRevision`);不符 → 提示「已被別人更新,請重新載入」。
 * 檢查器的錯草稿可以先存(隨回應帶回),正則不合法 / 不安全的 api 直接拒收。
 */
export const DesignerWorkspace = ({
  form,
  draft,
  onSaved,
  onReload,
}: DesignerWorkspaceProps) => {
  const t = useTranslations("admin.forms.designer");
  const tErrors = useTranslations("admin.forms.errors");
  const { session } = useSession();
  const state = useDesignerState(definitionOf(draft));
  const [revision, setRevision] = useState(draft.draftRevision);
  const [mode, setMode] = useState<DesignerMode>("design");
  const [error, setError] = useState<FormError | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [removingSection, setRemovingSection] = useState<LayoutSection | null>(
    null,
  );
  const listColumns = useModuleListColumnsQuery(session.client, {
    moduleKey: form.moduleKey,
  });
  const listColumnFieldKeys = (
    listColumns.data?.moduleListColumns.columns ?? []
  )
    .filter((column) => [null, undefined, form.key].includes(column.formKey))
    .map((column) => column.key);
  const { definition, report } = state;
  const selected =
    definition.fields.find((field) => field.key === state.selectedFieldKey) ??
    null;

  const save = useSaveFormVersionDraftMutation(
    session.client,
    useMutationFeedback({
      success: t("saved"),
      error: (failure) => tErrors(formErrorOf(failure).code),
      onSuccess: (payload) => {
        setRevision(payload.saveFormVersionDraft.formVersion.draftRevision);
        state.markSaved();
        setError(null);
        onSaved();
      },
      onError: (failure) => {
        setError(formErrorOf(failure));
      },
    }),
  );

  const locate = (issue: DefinitionIssue) => {
    setMode("design");
    state.select(issue.location.fieldKey ?? null);
  };

  const issuesOf = (fieldKey: string) =>
    [...report.errors, ...report.warnings].filter(
      (issue) => issue.location.fieldKey === fieldKey,
    );
  const formIssues = [...report.errors, ...report.warnings].filter(
    (issue) => issue.location.fieldKey === undefined,
  );
  const deletingField = definition.fields.find(
    (field) => field.key === deleting,
  );

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
      >
        <Tabs
          aria-label={t("mode")}
          value={mode}
          onChange={(next) => {
            setMode(next === "preview" ? "preview" : "design");
          }}
          items={[
            { value: "design", label: t("modeDesign") },
            { value: "preview", label: t("modePreview") },
          ]}
        />
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {state.isDirty
            ? t("unsaved", { revision })
            : t("revision", { revision })}
        </Typography>
        <Button
          disabled={!state.isDirty || save.isPending}
          onClick={() => {
            setError(null);
            save.mutate({
              input: {
                formKey: form.key,
                expectedDraftRevision: revision,
                ...rawOf(definition),
              },
            });
          }}
        >
          {t("save")}
        </Button>
      </Stack>
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
            {t("conflict")}
          </Alert>
        ) : (
          <Alert severity="error">
            <Stack spacing={0.5}>
              <span>{tErrors(error.code)}</span>
              {(error.issues ?? []).map((issue, index) => (
                <span key={`${issue.code}-${String(index)}`}>
                  {issue.message}
                </span>
              ))}
            </Stack>
          </Alert>
        ))}
      {mode === "preview" ? (
        <DesignerPreview
          formKey={form.key}
          definition={definition}
          isDirty={state.isDirty}
        />
      ) : (
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
          <ComponentPalette
            onAddField={(type: FieldType) => {
              state.add(type, t(`types.${type}`), null);
            }}
            onAddSection={() => {
              state.addSection(t("newSection"));
            }}
          />
          <DesignerCanvas
            formKey={form.key}
            definition={definition}
            selectedFieldKey={state.selectedFieldKey}
            onSelectField={state.select}
            onAddField={(type, target) => {
              state.add(type, t(`types.${type}`), target);
            }}
            onMoveField={state.move}
            onRenameSection={state.renameSection}
            onRemoveSection={setRemovingSection}
          />
          <Box
            component="section"
            aria-label={t("properties")}
            sx={{ width: 360, flexShrink: 0 }}
          >
            {selected === null ? (
              <FormSettingsPanel
                definition={definition}
                issues={formIssues}
                onChange={state.setDefinition}
              />
            ) : (
              <FieldPropertyPanel
                field={selected}
                fields={definition.fields}
                span={spanOf(definition, selected.key)}
                issues={issuesOf(selected.key)}
                onChange={(next) => {
                  state.update(selected.key, next);
                }}
                onSpanChange={(span) => {
                  state.setSpan(selected.key, span);
                }}
                onDelete={() => {
                  setDeleting(selected.key);
                }}
              />
            )}
          </Box>
        </Stack>
      )}
      <IssueList report={report} onLocate={locate} />
      <JsonPreview
        value={rawOf(definition)}
        label={t("jsonPreview")}
        maxHeight={320}
      />
      {deletingField !== undefined && (
        <DeleteFieldDialog
          field={deletingField}
          references={fieldReferences(
            definition,
            deletingField.key,
            listColumnFieldKeys,
          )}
          onCancel={() => {
            setDeleting(null);
          }}
          onConfirm={() => {
            state.remove(deletingField.key);
            setDeleting(null);
          }}
        />
      )}
      {removingSection !== null && (
        <DeleteSectionDialog
          section={removingSection}
          onCancel={() => {
            setRemovingSection(null);
          }}
          onConfirm={(sectionMode) => {
            state.removeSection(removingSection.key, sectionMode);
            setRemovingSection(null);
          }}
        />
      )}
    </Stack>
  );
};
