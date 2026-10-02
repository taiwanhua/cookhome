import type { ComponentType } from "react";
import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";

import type { DemoFilterOption, DemoFiltersProps } from "./demo-module-config";

export interface DemoListToolbarProps {
  i18nNamespace: string;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  option: DemoFilterOption | null;
  onOptionChange: (option: DemoFilterOption | null) => void;
  /** 模組自有的篩選器(示範模組1 的分類);不給就只有搜尋框 */
  Filters?: ComponentType<DemoFiltersProps>;
  /** 有 create 權限且綁了新增頁才出現新增鈕 */
  canCreate: boolean;
  onCreate: () => void;
}

/**
 * 列表工具列(Figma 176:489):搜尋(比對名稱與備註)+ 模組自有篩選器 + 新增。
 *
 * 搜尋與新增鈕是每個 CRUD 模組都有的,所以寫死在這裡;篩選器是模組差異,
 * 由設定物件的 `list.Filters` 放進來(對照組沒有篩選器,那一格就是空的)。
 */
export const DemoListToolbar = ({
  i18nNamespace,
  keyword,
  onKeywordChange,
  option,
  onOptionChange,
  Filters,
  canCreate,
  onCreate,
}: DemoListToolbarProps) => {
  const t = useTranslations(`${i18nNamespace}.toolbar`);

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
      {Filters !== undefined && (
        <Filters value={option} onChange={onOptionChange} />
      )}
      <Box sx={{ flex: 1 }} />
      {canCreate && <Button onClick={onCreate}>{t("create")}</Button>}
    </Stack>
  );
};
