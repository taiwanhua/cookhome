import { useTranslations } from "use-intl";

import { Autocomplete } from "@repo/ui/autocomplete";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";

import { SAMPLE_ONE_I18N } from "../demo-sample-one-config";
import type { DemoCategoryOption } from "../demo-sample-one-types";

export interface SampleOneToolbarProps {
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  category: DemoCategoryOption | null;
  onCategoryChange: (category: DemoCategoryOption | null) => void;
  categoryOptions: readonly DemoCategoryOption[];
  /** 選項拿不拿得到(需要欄位管理的檢視權限);拿不到就不顯示分類篩選 */
  isCategoryAvailable: boolean;
  isCategoryLoading: boolean;
  /** 有 create 權限且綁了新增頁才出現「新增示範項目」 */
  canCreate: boolean;
  onCreate: () => void;
}

/**
 * 列表工具列(Figma 176:489):搜尋(比對名稱與備註)+ 分類篩選 + 新增示範項目。
 *
 * 分類篩選用 `Autocomplete`(#307)而不是 Select:選項來自欄位管理,合併清單可能很長,
 * 輸入即過濾比「選單外再掛一個搜尋框」好用(STYLE-05 的兩條記錄)。
 * 拿不到選項時整個藏起來 —— 給一個永遠空的篩選器只會讓人以為沒有資料。
 */
export const SampleOneToolbar = ({
  keyword,
  onKeywordChange,
  category,
  onCategoryChange,
  categoryOptions,
  isCategoryAvailable,
  isCategoryLoading,
  canCreate,
  onCreate,
}: SampleOneToolbarProps) => {
  const t = useTranslations(`${SAMPLE_ONE_I18N}.toolbar`);

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <TextField
        label={t("search")}
        placeholder={t("searchPlaceholder")}
        size="small"
        value={keyword}
        sx={{ width: 280 }}
        onChange={(event) => {
          onKeywordChange(event.target.value);
        }}
      />
      {isCategoryAvailable && (
        <Autocomplete<DemoCategoryOption>
          options={categoryOptions}
          value={category}
          onChange={onCategoryChange}
          getOptionLabel={(option) => option.label}
          getOptionKey={(option) => option.value}
          label={t("category")}
          loading={isCategoryLoading}
          noOptionsText={t("categoryEmpty")}
          sx={{ width: 240 }}
        />
      )}
      <Box sx={{ flex: 1 }} />
      {canCreate && <Button onClick={onCreate}>{t("create")}</Button>}
    </Stack>
  );
};
