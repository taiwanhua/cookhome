import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";

import type { FormSubmissionStatus } from "@repo/graphql";
import { Card } from "@repo/ui/card";
import { IconButton } from "@repo/ui/icon-button";
import { DeleteIcon, EditIcon, ViewIcon } from "@repo/ui/icons";
import { Stack } from "@repo/ui/stack";
import { Tooltip } from "@repo/ui/tooltip";

import { useFormSubmission } from "@/hooks/useFormSubmission";
import { useModuleForms } from "@/hooks/useModuleForms";
import type { ModulePageProps } from "@/lib/module-tree";

import { FormPicker } from "../FormPicker";
import {
  FormSubmissionList,
  type FormSubmissionRow,
} from "../FormSubmissionList";
import { DeleteSubmissionDialog } from "./DeleteSubmissionDialog";
import { FormListToolbar } from "./FormListToolbar";
import { formModuleKeyOf, useFormModuleAccess } from "./useFormModuleAccess";

/**
 * 表單模組列表頁(預設組裝;Spec 6a §8 畫面 8):搜尋、依表單 / 狀態篩選、分頁;
 * 新增鈕 —— 此刻可新增的表單一張 → 直接進、多張 → 先選(`FormPicker`)。
 * 列操作依 api 的 `abilities`(已含權限)與「有沒有綁那一頁」相乘。
 */
export const FormListPage = ({ module }: ModulePageProps) => {
  const moduleKey = formModuleKeyOf(module.key);
  const t = useTranslations("admin.formEngine.pages");
  const navigate = useNavigate();
  const access = useFormModuleAccess(moduleKey);
  const { forms } = useModuleForms(moduleKey);

  // 篩選留在頁面層,不進 URL(REACT-02 第 2 點的 admin 例外)
  const [keyword, setKeywordValue] = useState("");
  const [formKey, setFormKeyValue] = useState<string | null>(null);
  const [status, setStatusValue] = useState<FormSubmissionStatus | null>(null);
  const [page, setPage] = useState(1);
  const [isPicking, setIsPicking] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FormSubmissionRow | null>(
    null,
  );
  const deletion = useFormSubmission(deleteTarget?.id ?? "");

  const goCreate = (key: string) => {
    if (access.createRoute !== null) {
      void navigate(`${access.createRoute}/${key}`);
    }
  };
  const handleCreate = () => {
    if (forms.length === 1) {
      goCreate(forms[0].key);
      return;
    }
    setIsPicking(true);
  };

  const labelOf = (row: FormSubmissionRow): string =>
    row.summary?.title ?? row.formName ?? row.formKey;

  const renderActions = (row: FormSubmissionRow) => (
    <Stack direction="row" spacing={0.5}>
      {access.viewRoute !== null && (
        <Tooltip title={t("view")} describeChild={false}>
          <IconButton
            size="small"
            aria-label={t("viewOf", { label: labelOf(row) })}
            onClick={() => {
              void navigate(`${access.viewRoute ?? ""}/${row.id}`);
            }}
          >
            <ViewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {access.editRoute !== null && row.abilities.canEdit && (
        <Tooltip title={t("edit")} describeChild={false}>
          <IconButton
            size="small"
            aria-label={t("editOf", { label: labelOf(row) })}
            onClick={() => {
              void navigate(`${access.editRoute ?? ""}/${row.id}`);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {row.abilities.canDelete && (
        <Tooltip title={t("delete")} describeChild={false}>
          <IconButton
            size="small"
            color="error"
            aria-label={t("deleteOf", { label: labelOf(row) })}
            onClick={() => {
              setDeleteTarget(row);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
      <FormListToolbar
        keyword={keyword}
        onKeywordChange={(value) => {
          setKeywordValue(value);
          setPage(1);
        }}
        forms={forms}
        formKey={formKey}
        onFormKeyChange={(value) => {
          setFormKeyValue(value);
          setPage(1);
        }}
        status={status}
        onStatusChange={(value) => {
          setStatusValue(value);
          setPage(1);
        }}
        canCreate={access.canCreate}
        hasForms={forms.length > 0}
        onCreate={handleCreate}
      />
      <Card
        sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <FormSubmissionList
          moduleKey={moduleKey}
          filters={{ keyword, formKey, status, page }}
          onPageChange={setPage}
          renderActions={renderActions}
          aria-label={t("tableAria", { module: module.name })}
        />
      </Card>
      {isPicking && (
        <FormPicker
          forms={forms}
          onPick={(form) => {
            setIsPicking(false);
            goCreate(form.key);
          }}
          onClose={() => {
            setIsPicking(false);
          }}
        />
      )}
      {deleteTarget !== null && (
        <DeleteSubmissionDialog
          label={labelOf(deleteTarget)}
          isSubmitting={deletion.isPending}
          errorCode={deletion.error?.code ?? null}
          onCancel={() => {
            setDeleteTarget(null);
          }}
          onConfirm={() => {
            void deletion.remove().then((isDeleted) => {
              if (isDeleted) {
                setDeleteTarget(null);
              }
            });
          }}
        />
      )}
    </Stack>
  );
};
