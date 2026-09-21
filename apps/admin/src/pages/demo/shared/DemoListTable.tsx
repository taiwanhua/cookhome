import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { IconButton } from "@repo/ui/icon-button";
import { DeleteIcon, EditIcon } from "@repo/ui/icons";
import { Stack } from "@repo/ui/stack";
import { Table, type TableColumn } from "@repo/ui/table";
import { Tag } from "@repo/ui/tag";
import { Tooltip } from "@repo/ui/tooltip";

import type { DemoColumn, DemoItemLike } from "./demo-module-config";

export interface DemoListTableProps<Row extends DemoItemLike> {
  i18nNamespace: string;
  columns: readonly DemoColumn<Row>[];
  minWidth: number;
  rows: readonly Row[];
  isLoading: boolean;
  /** 綁了詳情頁嗎(ADR-0011:可進 = 有那個模組路由) */
  canEnterView: boolean;
  /** 綁了編輯頁嗎;能不能改那一筆另外看 `row.abilities.canEdit` */
  canEnterEdit: boolean;
  onView: (row: Row) => void;
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
}

/**
 * 列表表格(Figma 176:499)。欄位由設定物件的 `list.columns` 決定,只有三種欄是內建的:
 * `name`(主要識別欄)、`enabled`(啟用標籤)、`actions`(列操作)—— 每個 CRUD 模組都一樣。
 * 其餘欄由設定物件自己給 `render`。
 *
 * **列操作一律讀 api 給的 `row.abilities`**,不與 `usePermissions` 相乘(模組文件
 * 「回傳欄位的語意」):那兩個欄位已經含權限判斷,前端再乘一次只會在「有權限但這一筆
 * 不給改」時對不起來。另外還要**綁了那一頁**才進得去,所以按鈕是兩個條件相乘。
 */
export const DemoListTable = <Row extends DemoItemLike>({
  i18nNamespace,
  columns,
  minWidth,
  rows,
  isLoading,
  canEnterView,
  canEnterEdit,
  onView,
  onEdit,
  onDelete,
}: DemoListTableProps<Row>) => {
  const t = useTranslations(i18nNamespace);
  const tColumns = useTranslations(`${i18nNamespace}.columns`);
  const tActions = useTranslations(`${i18nNamespace}.actions`);

  const renderActions = (row: Row): ReactNode => (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      {/* 檢視是文字鈕:`@repo/ui/icons` 還沒有「檢視」圖示(#344 補;補了再換) */}
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
        // 圖示鈕要有無障礙名字;Tooltip 指定 `describeChild={false}`(REACT-10)
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
  );

  /** 每個 CRUD 模組都一樣的三欄;其餘 key 由設定物件的 `render` 負責(沒給就是空的)。 */
  const builtIn: Partial<Record<string, (row: Row) => ReactNode>> = {
    name: (row) => <>{row.name}</>,
    enabled: (row) => (
      <Tag
        tone={row.enabled ? "success" : "grey"}
        label={row.enabled ? t("enabled.true") : t("enabled.false")}
      />
    ),
    actions: renderActions,
  };

  const tableColumns: TableColumn<Row>[] = columns.map((column) => ({
    key: column.key,
    header: tColumns(column.key),
    width: column.width,
    isEmphasized: column.isEmphasized ?? false,
    render: (row) =>
      column.render === undefined
        ? (builtIn[column.key]?.(row) ?? null)
        : column.render(row, t),
  }));

  return (
    <Table
      columns={tableColumns}
      rows={rows}
      getRowKey={(row) => row.id}
      isLoading={isLoading}
      size="small"
      minWidth={minWidth}
      emptyMessage={t("emptyList")}
      aria-label={t("tableAria")}
    />
  );
};
