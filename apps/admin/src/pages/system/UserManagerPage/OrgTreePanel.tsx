import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Card } from "@repo/ui/card";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { OrgTreePicker } from "../../../components/OrgTreePicker/OrgTreePicker";
import type { OrgNodeLike } from "../../../lib/org-tree";

export interface OrgTreePanelProps {
  nodes: readonly OrgNodeLike[];
  isLoading: boolean;
  /** 沒有 `system.org-manager.view` 時樹不可用,改顯示說明(清單退成整個可見範圍) */
  isAvailable: boolean;
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string | null) => void;
}

/**
 * 左欄組織樹(Figma OrgTree 91:263):選一個組織就把右側清單收斂到該組織子樹 ∩ 可見範圍。
 * 再點一次同一個節點等於取消選取 → 回到整個可見範圍。
 */
export const OrgTreePanel = ({
  nodes,
  isLoading,
  isAvailable,
  selectedOrgId,
  onSelectOrg,
}: OrgTreePanelProps) => {
  const t = useTranslations("admin.userManager.orgTree");

  return (
    <Card sx={{ p: 2, width: 280, flexShrink: 0 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle1">{t("title")}</Typography>
        <Typography variant="caption" color="text.secondary">
          {isAvailable ? t("hint") : t("all")}
        </Typography>
        {isAvailable ? (
          <OrgTreePicker
            nodes={nodes}
            isLoading={isLoading}
            selectedIds={selectedOrgId === null ? [] : [selectedOrgId]}
            onSelectedIdsChange={(ids) => {
              onSelectOrg(ids[0] ?? null);
            }}
            aria-label={t("title")}
          />
        ) : (
          <Alert severity="info">{t("unavailable")}</Alert>
        )}
      </Stack>
    </Card>
  );
};
