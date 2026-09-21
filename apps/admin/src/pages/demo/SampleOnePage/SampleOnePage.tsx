import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Card } from "@repo/ui/card";
import { Pagination } from "@repo/ui/pagination";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { useSession } from "@/hooks/useSession";

import { DeleteItemDialog } from "../DeleteItemDialog";
import {
  SAMPLE_ONE_I18N,
  SAMPLE_ONE_PAGE_SIZE,
  SAMPLE_ONE_QUERIES,
} from "../demo-sample-one-config";
import {
  type SampleOneErrorCode,
  sampleOneErrorOf,
} from "../demo-sample-one-error";
import type { DemoItemRow } from "../demo-sample-one-types";
import { useDemoCategoryOptions } from "../useDemoCategoryOptions";
import { useSampleOneAccess } from "../useSampleOneAccess";
import { SampleOneTable } from "./SampleOneTable";
import { SampleOneToolbar } from "./SampleOneToolbar";
import { useSampleOneList } from "./useSampleOneList";

// 模組層解構:`useDelete(...)` 是具名 hook 呼叫(設定物件見 `demo-sample-one-config.ts`)
const { useDelete } = SAMPLE_ONE_QUERIES;

/**
 * 示範模組1 列表(模組 key `demo.sub.sample-one`,正本 `docs/modules/demo.sub.sample-one.md`;
 * Figma「Screen / Admin 示範模組1 列表」175:3)。
 *
 * 搜尋 + 分類篩選 + 分頁的清單;列操作依 api 給的 `abilities` 與「有沒有綁那一頁的模組」出現,
 * 檢視 / 編輯是**導向另一個頁面**(隱藏頁模組),刪除是這一頁上的確認彈窗。
 */
export const SampleOnePage = () => {
  const t = useTranslations(SAMPLE_ONE_I18N);
  const { session } = useSession();
  const navigate = useNavigate();
  const access = useSampleOneAccess();
  const categories = useDemoCategoryOptions();
  const list = useSampleOneList();

  const [deleteTarget, setDeleteTarget] = useState<DemoItemRow | null>(null);
  const [deleteError, setDeleteError] = useState<SampleOneErrorCode | null>(
    null,
  );

  const deleteItem = useDelete(session.client, {
    onSuccess: () => {
      setDeleteTarget(null);
      void list.invalidate();
    },
    onError: (error: unknown) => {
      setDeleteError(sampleOneErrorOf(error).code);
    },
  });

  const pageCount = Math.max(
    1,
    Math.ceil(list.totalCount / SAMPLE_ONE_PAGE_SIZE),
  );

  const goTo = (route: string | null, id?: string) => {
    if (route === null) {
      return;
    }
    void navigate(id === undefined ? route : `${route}/${id}`);
  };

  return (
    // 撐滿殼給的內容區高度(STYLE-08):工具列固定,表格吃掉剩下的高度並自己捲(STYLE-11)
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
      <SampleOneToolbar
        keyword={list.keyword}
        onKeywordChange={list.setKeyword}
        category={list.category}
        onCategoryChange={list.setCategory}
        categoryOptions={categories.options}
        isCategoryAvailable={categories.isAvailable}
        isCategoryLoading={categories.isLoading}
        canCreate={access.canCreate}
        onCreate={() => {
          goTo(access.createRoute);
        }}
      />

      <Card
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 捲動責任在 Table 自己的容器(#299),這層只把剩下的高度傳下去 */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <SampleOneTable
            rows={list.rows}
            isLoading={list.isLoading}
            canEnterView={access.viewRoute !== null}
            canEnterEdit={access.editRoute !== null}
            onView={(row) => {
              goTo(access.viewRoute, row.id);
            }}
            onEdit={(row) => {
              goTo(access.editRoute, row.id);
            }}
            onDelete={(row) => {
              setDeleteError(null);
              setDeleteTarget(row);
            }}
          />
        </Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", px: 3, py: 1.5 }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {t("total", {
              total: list.totalCount,
              pageSize: SAMPLE_ONE_PAGE_SIZE,
            })}
          </Typography>
          <Pagination
            count={pageCount}
            page={list.page}
            onChange={(_event, nextPage) => {
              list.setPage(nextPage);
            }}
          />
        </Stack>
      </Card>

      {deleteTarget !== null && (
        <DeleteItemDialog
          itemName={deleteTarget.name}
          isSubmitting={deleteItem.isPending}
          errorCode={deleteError}
          onCancel={() => {
            setDeleteError(null);
            setDeleteTarget(null);
          }}
          onConfirm={() => {
            setDeleteError(null);
            deleteItem.mutate({ input: { id: deleteTarget.id } });
          }}
        />
      )}
    </Stack>
  );
};
