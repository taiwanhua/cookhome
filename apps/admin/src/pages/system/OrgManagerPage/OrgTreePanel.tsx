import { useCallback, useMemo } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import { OrgTreePicker } from "@/components/OrgTreePicker/OrgTreePicker";
import type { OrgNodeLike } from "@/lib/org-tree";

export interface OrgTreePanelProps {
  nodes: readonly OrgNodeLike[];
  isLoading: boolean;
  /** 根組織視角:樹根是根組織,它的直接子組織才是租戶(租戶視角看不到這層,標籤也就不出現) */
  isRootPerspective: boolean;
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string | null) => void;
  canProvision: boolean;
  canCreateChild: boolean;
  /** 選中的組織在可見範圍內才能往它底下新增 */
  isCreateChildEnabled: boolean;
  onProvision: () => void;
  onCreateChild: () => void;
}

/**
 * 左欄組織樹(Figma OrgTree 87:215 根組織視角 / 92:700 租戶視角)。
 * 兩種視角是同一棵樹,差別只在資料(樹根是誰)與權限(有沒有「開通租戶」),不是兩個元件。
 * 可見範圍外的節點由 `toTreeNodes` 轉成 disabled(顯示但不可選,ADR-0005);
 * 停用的組織在名稱旁掛一個 `Tag`(Figma Draft/OrgTreeItem 的 ShowTag 槽位 → `TreeNode.labelSuffix`)。
 */
export const OrgTreePanel = ({
  nodes,
  isLoading,
  isRootPerspective,
  selectedOrgId,
  onSelectOrg,
  canProvision,
  canCreateChild,
  isCreateChildEnabled,
  onProvision,
  onCreateChild,
}: OrgTreePanelProps) => {
  const t = useTranslations("admin.orgManager.tree");

  /** 租戶頂層 = 根組織的直接子組織;租戶視角看不到根組織,所以這個標籤只在根組織視角出現。 */
  const tenantTopIds = useMemo(
    () =>
      new Set(
        isRootPerspective
          ? (nodes[0]?.children ?? []).map((child) => child.id)
          : [],
      ),
    [nodes, isRootPerspective],
  );

  const labelSuffixOf = useCallback(
    (node: OrgNodeLike) => {
      if (!node.enabled) {
        return <Tag tone="error" label={t("disabledTag")} />;
      }
      return tenantTopIds.has(node.id) ? (
        <Tag tone="grey" label={t("tenantTag")} />
      ) : undefined;
    },
    [tenantTopIds, t],
  );

  return (
    <Card sx={{ p: 2, width: 360, flexShrink: 0, alignSelf: "stretch" }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            {t("title")}
          </Typography>
          {canProvision && (
            <Button size="small" onClick={onProvision}>
              {t("provision")}
            </Button>
          )}
          {canCreateChild && (
            <Button
              size="small"
              variant="outlined"
              disabled={!isCreateChildEnabled}
              onClick={onCreateChild}
            >
              {t("createChild")}
            </Button>
          )}
        </Stack>
        <OrgTreePicker
          nodes={nodes}
          isLoading={isLoading}
          selectedIds={selectedOrgId === null ? [] : [selectedOrgId]}
          onSelectedIdsChange={(ids) => {
            onSelectOrg(ids[0] ?? null);
          }}
          labelSuffixOf={labelSuffixOf}
          aria-label={t("title")}
        />
      </Stack>
    </Card>
  );
};
