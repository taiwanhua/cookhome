import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { IconButton } from "@repo/ui/icon-button";
import { DeleteIcon, EditIcon } from "@repo/ui/icons";
import { Stack } from "@repo/ui/stack";
import { Table, type TableColumn } from "@repo/ui/table";
import { Tag } from "@repo/ui/tag";
import { Tooltip } from "@repo/ui/tooltip";
import { Typography } from "@repo/ui/typography";

import {
  SAMPLE_ONE_COLUMNS,
  SAMPLE_ONE_I18N,
  SAMPLE_ONE_TABLE_MIN_WIDTH,
} from "../demo-sample-one-config";
import type { DemoItemRow } from "../demo-sample-one-types";
import { statusToneOf } from "../demo-sample-one-view";

export interface SampleOneTableProps {
  rows: readonly DemoItemRow[];
  isLoading: boolean;
  /** 蝬?閰單????炎閬?ADR-0011:?舫?= ??芋蝯楝?? */
  canEnterView: boolean;
  /** 蝬?蝺刻摩???楊頛胯??賭??賣???蝑??`row.abilities.canEdit` */
  canEnterEdit: boolean;
  onView: (row: DemoItemRow) => void;
  onEdit: (row: DemoItemRow) => void;
  onDelete: (row: DemoItemRow) => void;
}

/**
 * 蝷箇??皜(Figma 176:499)??雿 `SAMPLE_ONE_COLUMNS` 摰儔?ㄐ??撖虫??急?,
 * ?芋蝯??身摰?????#321 ?迨?賢??)?? *
 * ??雿?*銝敺? api 蝯衣? `row.abilities`**,銝???`usePermissions` ?訾?(璅∠??辣
 * ???單?雿?隤?????璇????蝞?甈?撠?韏瑚?撠望?恍??API 銝???;
 * ?血?憭?銝隞?`abilities` 銵券?銝??? ???????璅∠?????,瘝?撠梁??賣銋脖??颯? */
export const SampleOneTable = ({
  rows,
  isLoading,
  canEnterView,
  canEnterEdit,
  onView,
  onEdit,
  onDelete,
}: SampleOneTableProps) => {
  const t = useTranslations(SAMPLE_ONE_I18N);
  const tColumns = useTranslations(`${SAMPLE_ONE_I18N}.columns`);
  const tActions = useTranslations(`${SAMPLE_ONE_I18N}.actions`);

  const renderers: Record<string, (row: DemoItemRow) => ReactNode> = {
    name: (row) => row.name,
    category: (row) => (
      <Typography variant="body2" color="text.secondary">
        {row.categoryLabel ?? row.category ?? t("emptyValue")}
      </Typography>
    ),
    note: (row) => (
      <Typography variant="body2" color="text.secondary">
        {row.note ?? t("emptyValue")}
      </Typography>
    ),
    status: (row) => (
      <Tag tone={statusToneOf(row.status)} label={t(`status.${row.status}`)} />
    ),
    enabled: (row) => (
      <Tag
        tone={row.enabled ? "success" : "grey"}
        label={row.enabled ? t("enabled.true") : t("enabled.false")}
      />
    ),
    actions: (row) => (
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        {/* ?炎閬?????`@repo/ui/icons` 瘝?撠??炎閬?蝷?閮剛?蝔輻???舀?摮?? */}
        {canEnterView && (
          <Button
            variant="text"
            size="small"
            onClick={() => {
              onView(row);
            }}
          >
            {tActions("view")}
          </Button>
        )}
        {canEnterEdit && row.abilities.canEdit && (
          // ?內???閬?摮????內撠望摰???,`describeChild={false}`(REACT-10)
          <Tooltip title={tActions("edit")} describeChild={false}>
            <IconButton
              size="small"
              aria-label={tActions("editOf", { name: row.name })}
              onClick={() => {
                onEdit(row);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {row.abilities.canDelete && (
          <Tooltip title={tActions("delete")} describeChild={false}>
            <IconButton
              size="small"
              color="error"
              aria-label={tActions("deleteOf", { name: row.name })}
              onClick={() => {
                onDelete(row);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    ),
  };

  const columns: TableColumn<DemoItemRow>[] = SAMPLE_ONE_COLUMNS.map(
    (column) => ({
      key: column.key,
      header: tColumns(column.key),
      width: "width" in column ? column.width : undefined,
      isEmphasized: "isEmphasized" in column,
      render: renderers[column.key] ?? (() => null),
    }),
  );

  return (
    <Table
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      isLoading={isLoading}
      size="small"
      minWidth={SAMPLE_ONE_TABLE_MIN_WIDTH}
      emptyMessage={t("emptyList")}
      aria-label={t("tableAria")}
    />
  );
};
