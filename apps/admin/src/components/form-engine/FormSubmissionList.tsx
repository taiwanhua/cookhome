import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import { isDateTimeString } from "@repo/domain/form";
import {
  type FormSubmissionFieldsFragment,
  type FormSubmissionStatus,
  ModuleListColumnKind,
  useFormSubmissionsQuery,
  useModuleListColumnsQuery,
} from "@repo/graphql";
import { Box } from "@repo/ui/box";
import { DataTable, type DataTableColumn } from "@repo/ui/data-table";
import { Pagination } from "@repo/ui/pagination";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { useDateTimeText } from "@/hooks/useDateTimeText";
import { useSession } from "@/hooks/useSession";
import { useVersionDefinitions } from "@/hooks/useVersionDefinitions";
import {
  type ListColumnSpec,
  columnIdOf,
  resolveListCell,
  sortedColumns,
} from "@/lib/form-engine/list-columns";

import { SubmissionStatusTag } from "../workflow/SubmissionStatusTag";
import { renderValue } from "./render-value";

export type FormSubmissionRow = FormSubmissionFieldsFragment;

export interface FormSubmissionListFilters {
  keyword: string;
  formKey: string | null;
  status: FormSubmissionStatus | null;
  page: number;
}

export interface FormSubmissionListProps {
  moduleKey: string;
  filters: FormSubmissionListFilters;
  onPageChange: (page: number) => void;
  /** 自訂欄;不給 = 模組的列表欄位配置(沒設定過 = 預設的標題 + 日期) */
  columns?: readonly ListColumnSpec[];
  pageSize?: number;
  /** 列尾的操作(檢視 / 編輯 / 刪除,由組裝頁決定) */
  renderActions?: (row: FormSubmissionRow) => ReactNode;
  "aria-label"?: string;
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * 提交列表(Spec 6a §8 `<FormSubmissionList moduleKey columns? …>`,`DataTable` + REACT-13 `render(ctx)`)。
 *
 * 欄位來自列表欄位配置(摘要槽或表單欄位);表單欄位的一格依**那一筆綁的版本**判斷:
 * 配置引用的欄位在那一版不存在(或是別張表單的欄位)→ 顯示「—」。範圍(可見範圍 + 資料範圍規則)由 api 套,
 * 別人的草稿不列;搜尋只比對摘要標題。
 */
export const FormSubmissionList = ({
  moduleKey,
  filters,
  onPageChange,
  columns,
  pageSize = DEFAULT_PAGE_SIZE,
  renderActions,
  "aria-label": ariaLabel,
}: FormSubmissionListProps) => {
  const t = useTranslations("admin.formEngine.list");
  const tValue = useTranslations("admin.formEngine.renderer");
  const dateTimeText = useDateTimeText();
  const { session } = useSession();

  const configured = useModuleListColumnsQuery(
    session.client,
    { moduleKey },
    { enabled: columns === undefined },
  );
  const specs = sortedColumns(
    columns ?? configured.data?.moduleListColumns.columns ?? [],
  );

  const query = useFormSubmissionsQuery(session.client, {
    input: {
      moduleKey,
      keyword: filters.keyword,
      page: filters.page,
      pageSize,
      ...(filters.formKey !== null && { formKey: filters.formKey }),
      ...(filters.status !== null && { status: filters.status }),
    },
  });
  const rows = query.data?.formSubmissions.items ?? [];
  const totalCount = query.data?.formSubmissions.totalCount ?? 0;
  const definitionOf = useVersionDefinitions(rows);
  /** 表單欄位欄的表頭:這一頁任一筆的版本裡找得到就用它的 label,否則顯示欄位 key。 */
  const fieldLabelOf = (fieldKey: string): string =>
    rows
      .map(
        (row) =>
          definitionOf(row.formKey, row.version)?.fields.find(
            (field) => field.key === fieldKey,
          )?.label,
      )
      .find((label) => label !== undefined) ?? fieldKey;
  const valueText = {
    empty: tValue("empty"),
    yes: tValue("yes"),
    no: tValue("no"),
    unavailable: tValue("sourceUnavailable"),
  };

  const configuredColumns: DataTableColumn<FormSubmissionRow>[] = specs.map(
    (spec) => ({
      key: columnIdOf(spec),
      header:
        spec.kind === ModuleListColumnKind.Slot
          ? t(`slots.${spec.key}`)
          : fieldLabelOf(spec.key),
      width: spec.width,
      render: ({ row }) => {
        const cell = resolveListCell(
          spec,
          row,
          (formKey, version) => definitionOf(formKey, version)?.fields,
        );
        // 引用的欄位在那一筆的版本不存在(或是別張表單的欄位)→「—」
        let node: ReactNode = valueText.empty;
        const timezone = row.ctx?.timezone;
        if (cell.kind === "slot") {
          // 摘要槽「日期」對到日期時間欄(或沒對 = 送出時間)時是 ISO 時點:以那一筆的時區格式化
          if (cell.value === null) {
            node = valueText.empty;
          } else {
            node = isDateTimeString(cell.value)
              ? dateTimeText(cell.value, timezone)
              : cell.value;
          }
        } else if (cell.kind === "field") {
          node = renderValue({
            field: cell.field,
            value: cell.value,
            display:
              row.displayValues.find((entry) => entry.fieldKey === spec.key)
                ?.items ?? [],
            text: valueText,
            ...(timezone !== undefined && { timezone }),
          });
        }
        return node;
      },
    }),
  );

  const tableColumns: DataTableColumn<FormSubmissionRow>[] = [
    ...configuredColumns,
    {
      key: "form",
      header: t("form"),
      width: 160,
      render: ({ row }) => row.formName ?? row.formKey,
    },
    {
      key: "status",
      header: t("status"),
      width: 140,
      render: ({ row }) => (
        <SubmissionStatusTag status={row.status} blocked={row.blocked} />
      ),
    },
    {
      key: "createdBy",
      header: t("createdBy"),
      width: 140,
      render: ({ row }) => row.createdBy?.name ?? valueText.empty,
    },
    ...(renderActions === undefined
      ? []
      : [
          {
            key: "actions",
            header: t("actions"),
            width: 180,
            pinned: "right" as const,
            render: ({ row }: { row: FormSubmissionRow }) => renderActions(row),
          },
        ]),
  ];

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataTable
          columns={tableColumns}
          rows={rows}
          getRowKey={(row) => row.id}
          isLoading={query.isLoading}
          emptyMessage={t("empty")}
          size="small"
          aria-label={ariaLabel ?? t("tableAria")}
        />
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", px: 3, py: 1.5 }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {t("total", { total: totalCount })}
        </Typography>
        <Pagination
          count={pageCount}
          page={filters.page}
          onChange={(_event, next) => {
            onPageChange(next);
          }}
        />
      </Stack>
    </Stack>
  );
};
