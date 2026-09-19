import { useCallback, useMemo } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import { OrgTreePicker } from "@/components/OrgTreePicker/OrgTreePicker";
import { type OrgNodeLike, flattenOrgs } from "@/lib/org-tree";

export interface OrgTreePanelProps {
  nodes: readonly OrgNodeLike[];
  isLoading: boolean;
  /** 平台根組織的 id(只有管理範圍是全部的人樹上才有);它的直接子組織才是租戶 */
  rootOrgId: string | null;
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string | null) => void;
  canProvision: boolean;
  canCreateChild: boolean;
  /** 選中的組織在管理範圍內才能往它底下新增 */
  isCreateChildEnabled: boolean;
  onProvision: () => void;
  onCreateChild: () => void;
}

/**
 * 左欄組織樹(Figma OrgTree 87:215 根組織視角 / 92:700 租戶視角)。
 * 兩種視角是同一棵樹,差別只在資料(樹根是誰)與權限(有沒有「開通租戶」),不是兩個元件。
 * 樹上就是操作者的**管理範圍**(#187),根可能有多個、範圍外的組織不會出現;
 * 停用的組織在名稱旁掛一個 `Tag`(Figma Draft/OrgTreeItem 的 ShowTag 槽位 → `TreeNode.labelSuffix`)。
 */
export const OrgTreePanel = ({
  nodes,
  isLoading,
  rootOrgId,
  selectedOrgId,
  onSelectOrg,
  canProvision,
  canCreateChild,
  isCreateChildEnabled,
  onProvision,
  onCreateChild,
}: OrgTreePanelProps) => {
  const t = useTranslations("admin.orgManager.tree");

  /**
   * 租戶頂層 = **父節點是平台根組織**的節點(`parentId === rootOrgId`),
   * 不是「父節點是樹根」— 樹根是租戶頂層時,它的子組織不是租戶
   * (docs/modules/org-manager.md「管理範圍與租戶標示」)。
   * 樹上沒有平台根組織的人看不到那一層,標籤自然不出現。
   */
  const tenantTopIds = useMemo(
    () =>
      new Set(
        rootOrgId === null
          ? []
          : flattenOrgs(nodes)
              .filter((org) => org.parentId === rootOrgId)
              .map((org) => org.id),
      ),
    [nodes, rootOrgId],
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
