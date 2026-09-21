import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type { DemoItemsOneQueryVariables } from "@repo/graphql";

import { useSession } from "@/hooks/useSession";

import {
  SAMPLE_ONE_PAGE_SIZE,
  SAMPLE_ONE_QUERIES,
} from "../demo-sample-one-config";
import type { DemoCategoryOption, DemoItemRow } from "../demo-sample-one-types";

// 模組層解構:`useList(...)` 是具名 hook 呼叫,react-hooks 的規則才認得出來(設定物件見 config)
const { useList } = SAMPLE_ONE_QUERIES;

export interface SampleOneList {
  keyword: string;
  setKeyword: (keyword: string) => void;
  category: DemoCategoryOption | null;
  setCategory: (category: DemoCategoryOption | null) => void;
  page: number;
  setPage: (page: number) => void;
  rows: readonly DemoItemRow[];
  totalCount: number;
  isLoading: boolean;
  /** 寫入成功後重查這一頁(DATA-02 / 04:只失效當前這份清單) */
  invalidate: () => Promise<void>;
}

/**
 * 列表頁的資料層(Figma 175:3)。篩選條件(關鍵字、分類、頁碼)留在頁面層的 `useState`,
 * 不進 URL —— admin 有路由頁籤,頁內篩選在頁籤行為定案前一律如此(REACT-02 第 2 點的 admin 例外)。
 *
 * 範圍(可見範圍 + 資料範圍規則)由 api 自動套,前端不送任何組織條件。
 */
export const useSampleOneList = (): SampleOneList => {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [keyword, setKeywordValue] = useState("");
  const [category, setCategoryValue] = useState<DemoCategoryOption | null>(
    null,
  );
  const [page, setPage] = useState(1);

  const variables = useMemo<DemoItemsOneQueryVariables>(
    () => ({
      input: {
        page,
        pageSize: SAMPLE_ONE_PAGE_SIZE,
        keyword: keyword.trim() === "" ? null : keyword.trim(),
        category: category?.value ?? null,
      },
    }),
    [page, keyword, category],
  );

  const list = useList(session.client, variables);

  /** 換關鍵字或換分類都回到第一頁(否則會停在一個不存在的頁碼上看到空清單)。 */
  const setKeyword = (value: string) => {
    setKeywordValue(value);
    setPage(1);
  };
  const setCategory = (value: DemoCategoryOption | null) => {
    setCategoryValue(value);
    setPage(1);
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: useList.getKey(variables),
    });
  };

  return {
    keyword,
    setKeyword,
    category,
    setCategory,
    page,
    setPage,
    rows: list.data?.demoItemsOne.items ?? [],
    totalCount: list.data?.demoItemsOne.totalCount ?? 0,
    isLoading: list.isLoading,
    invalidate,
  };
};
