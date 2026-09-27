import { useState } from "react";
import { useTranslations } from "use-intl";

import type { FieldType, LayoutSection } from "@repo/domain/form";
import {
  type FormFieldsFragment,
  type FormVersionFieldsFragment,
  useModuleListColumnsQuery,
} from "@repo/graphql";
import { Box } from "@repo/ui/box";
import { Stack } from "@repo/ui/stack";

import { JsonPreview } from "@/components/JsonPreview";
import { useSession } from "@/hooks/useSession";
import { definitionOf, rawOf } from "@/lib/form-engine/definition";
import type { DesignerIssue } from "@/lib/form-engine/designer-issues";
import { sectionCols, spanOf } from "@/lib/form-engine/designer-ops";
import {
  fieldReferences,
  sectionReferences,
} from "@/lib/form-engine/field-references";

import { ComponentPalette } from "./ComponentPalette";
import { DeleteFieldDialog } from "./DeleteFieldDialog";
import { DeleteSectionDialog } from "./DeleteSectionDialog";
import { DesignerCanvas } from "./DesignerCanvas";
import { DesignerPreview } from "./DesignerPreview";
import { type DesignerMode, DesignerToolbar } from "./DesignerToolbar";
import { FormSettingsPanel } from "./FormSettingsPanel/FormSettingsPanel";
import { IssueList } from "./IssueList";
import { FieldPropertyPanel } from "./PropertyPanel/FieldPropertyPanel";
import { useDesignerSave } from "./useDesignerSave";
import { useDesignerState } from "./useDesignerState";

export interface DesignerWorkspaceProps {
  form: FormFieldsFragment;
  draft: FormVersionFieldsFragment;
  onSaved: () => void;
  onReload: () => void;
}

/**
 * 設計器本體(Spec 6a §8 畫面 2):元件面板 / 畫布 / 屬性面板 / JSON 預覽 / 檢查結果;「預覽」切到 `preview` 模式。
 * 存草稿帶 `expectedDraftRevision`(= 讀到或上次存完的 `draftRevision`);不符 → 提示「已被別人更新,請重新載入」。
 * 有沒有未存的變更回報給 `useDesignerDraftStore`(換表單攔截、發布跳窗提示都看它)。
 */
export const DesignerWorkspace = ({
  form,
  draft,
  onSaved,
  onReload,
}: DesignerWorkspaceProps) => {
  const t = useTranslations("admin.forms.designer");
  const { session } = useSession();
  const state = useDesignerState(definitionOf(draft));
  const { definition, report } = state;
  const saving = useDesignerSave({
    formKey: form.key,
    initialRevision: draft.draftRevision,
    definition,
    isDirty: state.isDirty,
    markSaved: state.markSaved,
    onSaved,
  });
  const [mode, setMode] = useState<DesignerMode>("design");
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
  const selected =
    definition.fields.find((field) => field.key === state.selectedFieldKey) ??
    null;
  const allIssues = [...report.errors, ...report.warnings];

  /** 點檢查結果定位:有欄位就選它;其餘(摘要槽、帶入規則、版面格)回到表單設定。 */
  const locate = (issue: DesignerIssue) => {
    setMode("design");
    state.select(issue.location.fieldKey ?? null);
  };
  const deletingField = definition.fields.find(
    (field) => field.key === deleting,
  );

  return (
    <Stack spacing={2}>
      <DesignerToolbar
        mode={mode}
        onModeChange={setMode}
        revision={saving.revision}
        isDirty={state.isDirty}
        isSaving={saving.isPending}
        error={saving.error}
        onSave={() => {
          void saving.save();
        }}
        onReload={onReload}
      />
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
              state.add(type, t(`types.${type}`), null, t("newSection"));
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
              state.add(type, t(`types.${type}`), target, t("newSection"));
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
                issues={allIssues.filter(
                  (issue) => issue.location.fieldKey === undefined,
                )}
                onChange={state.setDefinition}
              />
            ) : (
              <FieldPropertyPanel
                field={selected}
                fields={definition.fields}
                span={spanOf(definition, selected.key)}
                issues={allIssues.filter(
                  (issue) => issue.location.fieldKey === selected.key,
                )}
                onChange={(next) => {
                  state.update(selected.key, next);
                }}
                onSpanChange={(span) => {
                  state.setSpan(selected.key, span);
                }}
                onDelete={() => {
                  setDeleting(selected.key);
                }}
                onBack={() => {
                  state.select(null);
                }}
              />
            )}
          </Box>
        </Stack>
      )}
      <IssueList
        report={report}
        regexStatus={state.regexStatus}
        onLocate={locate}
      />
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
          references={sectionReferences(
            definition,
            sectionCols(removingSection).map((col) => col.fieldKey),
            listColumnFieldKeys,
          )}
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
