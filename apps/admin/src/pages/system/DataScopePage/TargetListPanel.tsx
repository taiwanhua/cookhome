import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Card } from "@repo/ui/card";
import { CircularProgress } from "@repo/ui/circular-progress";
import { List, ListItemButton } from "@repo/ui/list";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import type { DataScopeTarget } from "./data-scope-types";

export interface TargetListPanelProps {
  targets: readonly DataScopeTarget[];
  isLoading: boolean;
  selectedCollection: string | null;
  /** 有未儲存變更時由頁面攔下來先問(放棄變更確認),不是直接切 */
  onSelectTarget: (collection: string) => void;
  /** 已經有規則的 collection(左清單的「已設規則」標籤) */
  collectionsWithRule: ReadonlySet<string>;
}

/**
 * 左欄資料目標清單(Figma TargetList 167:237):中文名 + collection + 有沒有規則。
 * 清單來自各模組 seed 宣告的 `dataScopeTarget`(ADR-0008),頁面不能新增或刪除。
 */
export const TargetListPanel = ({
  targets,
  isLoading,
  selectedCollection,
  onSelectTarget,
  collectionsWithRule,
}: TargetListPanelProps) => {
  const t = useTranslations("admin.dataScope.targets");

  return (
    <Card
      sx={{
        p: 2,
        width: 320,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Stack spacing={1} sx={{ flex: 1, minHeight: 0 }}>
        <Typography variant="subtitle1">{t("title")}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t("hint")}
        </Typography>
        {/* 清單佔滿標題以外的高度,超出時自己捲(STYLE-08) */}
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {isLoading && (
            <Stack sx={{ alignItems: "center", py: 4 }}>
              <CircularProgress aria-label={t("loading")} />
            </Stack>
          )}
          {!isLoading && targets.length === 0 && (
            <Typography variant="body2">{t("empty")}</Typography>
          )}
          <List aria-label={t("title")} disablePadding>
            {targets.map((target) => (
              <ListItemButton
                key={target.collection}
                selected={target.collection === selectedCollection}
                sx={{ borderRadius: 1, mb: 0.5 }}
                onClick={() => {
                  onSelectTarget(target.collection);
                }}
              >
                <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Typography variant="subtitle2">{target.name}</Typography>
                    {collectionsWithRule.has(target.collection) && (
                      <Tag tone="primary" label={t("hasRule")} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {target.collection}
                  </Typography>
                </Stack>
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Stack>
    </Card>
  );
};
