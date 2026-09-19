import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Card } from "@repo/ui/card";
import { CircularProgress } from "@repo/ui/circular-progress";
import { List, ListItemButton, ListItemText } from "@repo/ui/list";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type { FieldCategoryLike } from "./field-manager-types";

export interface CategoryListPanelProps {
  categories: readonly FieldCategoryLike[];
  isLoading: boolean;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
}

/**
 * 左欄欄位類別(Figma Categories 90:215):名稱 + 類別 key,整頁唯讀 ——
 * 類別是種子資料,新增 / 改名走 code + PR(ADR-0002、field-manager.md)。
 */
export const CategoryListPanel = ({
  categories,
  isLoading,
  selectedCategoryId,
  onSelectCategory,
}: CategoryListPanelProps) => {
  const t = useTranslations("admin.fieldManager.categories");

  return (
    <Card
      component="section"
      aria-label={t("title")}
      sx={{
        p: 2,
        width: 300,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Stack spacing={0.25} sx={{ flex: 1, minHeight: 0 }}>
        <Typography variant="subtitle1">{t("title")}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t("seedNotice")}
        </Typography>
        {/* 清單佔滿標題列以外的高度,超出時自己捲(STYLE-08) */}
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pt: 1 }}>
          {isLoading ? (
            <Stack sx={{ alignItems: "center", py: 3 }}>
              <CircularProgress aria-label={t("loading")} />
            </Stack>
          ) : (
            <List disablePadding>
              {categories.map((category) => (
                <ListItemButton
                  key={category.id}
                  selected={category.id === selectedCategoryId}
                  sx={{ borderRadius: 1 }}
                  onClick={() => {
                    onSelectCategory(category.id);
                  }}
                >
                  <ListItemText
                    primary={category.name}
                    secondary={category.key}
                    slotProps={{
                      primary: { variant: "subtitle2" },
                      secondary: { variant: "caption" },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Stack>
    </Card>
  );
};
