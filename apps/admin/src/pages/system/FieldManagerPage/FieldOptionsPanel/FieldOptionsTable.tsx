import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Switch } from "@repo/ui/switch";
import { Table, type TableColumn } from "@repo/ui/table";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import type { FieldOptionLike } from "../field-manager-types";
import {
  canEditOption,
  canToggleOption,
  fieldSourceView,
  isSeedOption,
} from "../field-source";

export interface FieldOptionsTableProps {
  fields: readonly FieldOptionLike[];
  isLoading: boolean;
  /** 來源欄的「<組織名稱> 自訂」;api 不傳組織名,取 session 的當前組織(GQL-07) */
  currentOrgName: string;
  /** 站在根組織:種子選項的全域開關只有根組織切得動 */
  isRoot: boolean;
  canEdit: boolean;
  canToggleEnabled: boolean;
  /** 正在送出的那一筆(同時只會有一筆) */
  pendingFieldId: string | null;
  onToggleEnabled: (field: FieldOptionLike, enabled: boolean) => void;
  onEdit: (field: FieldOptionLike) => void;
}

/**
 * 選項表格(Figma 90:232 起):顯示名稱、值、排序、來源、啟用、操作。
 *
 * 與 Figma 的兩處差異(PR 差異表有列):設計稿把「狀態」畫成唯讀 Tag、開關另計,
 * 這裡依票直接用 `Switch`(停用 / 啟用直接送,不另開確認);沒有 `toggle-enabled`
 * 權限時才退回 Tag。種子列在非根組織視角是**唯讀**的開關 + 一句說明,
 * 不是把它藏起來 —— 看得到但動不了,跟「這個動作我沒有權限」是兩回事。
 */
export const FieldOptionsTable = ({
  fields,
  isLoading,
  currentOrgName,
  isRoot,
  canEdit,
  canToggleEnabled,
  pendingFieldId,
  onToggleEnabled,
  onEdit,
}: FieldOptionsTableProps) => {
  const t = useTranslations("admin.fieldManager.options");

  const columns: TableColumn<FieldOptionLike>[] = [
    {
      key: "label",
      header: t("label"),
      width: 180,
      isEmphasized: true,
      render: (field) => field.label,
    },
    {
      key: "value",
      header: t("value"),
      width: 140,
      render: (field) => (
        <Typography variant="body2" color="text.secondary">
          {field.value}
        </Typography>
      ),
    },
    {
      key: "order",
      header: t("order"),
      width: 64,
      render: (field) => field.order,
    },
    {
      key: "source",
      header: t("source"),
      width: 140,
      render: (field) => {
        const view = fieldSourceView(field);
        return (
          <Tag
            tone={view.tone}
            label={
              view.labelKey === "sourceGlobal"
                ? t("sourceGlobal")
                : t("sourceOwn", { org: currentOrgName })
            }
          />
        );
      },
    },
    {
      key: "enabled",
      header: t("enabled"),
      width: 96,
      render: (field) => {
        const isToggleable = canToggleOption(field, {
          canToggleEnabled,
          isRoot,
        });
        if (!canToggleEnabled) {
          return (
            <Tag
              tone={field.enabled ? "success" : "error"}
              label={field.enabled ? t("stateEnabled") : t("stateDisabled")}
            />
          );
        }
        return (
          <Box
            component="span"
            title={isToggleable ? undefined : t("seedManagedHint")}
          >
            <Switch
              checked={field.enabled}
              disabled={!isToggleable || pendingFieldId === field.id}
              onChange={(_event, checked) => {
                onToggleEnabled(field, checked);
              }}
              slotProps={{
                input: { "aria-label": t("toggleAria", { name: field.label }) },
              }}
            />
          </Box>
        );
      },
    },
    {
      key: "actions",
      header: t("actions"),
      render: (field) => {
        if (canEditOption(field, { canEdit })) {
          return (
            <Button
              variant="text"
              size="small"
              onClick={() => {
                onEdit(field);
              }}
            >
              {t("edit")}
            </Button>
          );
        }
        // 種子列講明「為什麼不能編輯」;自訂列只是沒有 edit 權限,不需要解釋
        return (
          <Typography variant="body2" color="text.disabled">
            {isSeedOption(field) ? t("seedManaged") : t("none")}
          </Typography>
        );
      },
    },
  ];

  return (
    <Table
      columns={columns}
      rows={fields}
      getRowKey={(field) => field.id}
      isLoading={isLoading}
      size="small"
      minWidth={720}
      emptyMessage={t("empty")}
      aria-label={t("tableAria")}
    />
  );
};
