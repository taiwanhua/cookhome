import { useTranslations } from "use-intl";

import { Avatar } from "@repo/ui/avatar";
import { Card } from "@repo/ui/card";
import { CircularProgress } from "@repo/ui/circular-progress";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import type { OrgActionAbility, OrgDetail } from "../org-manager-types";
import { OrgActionBar } from "./OrgActionBar";
import { OrgDetailRow } from "./OrgDetailRow";

export interface OrgDetailPanelProps {
  org: OrgDetail | undefined;
  isLoading: boolean;
  /** 上層組織名稱(從樹上取,`org(id)` 只給 `parentId`);樹根沒有上層 */
  parentName: string | null;
  /** 租戶擁有者的姓名;沒有使用者清單權限或不是租戶頂層時為 null */
  ownerName: string | null;
  /** 這個組織有擁有者(= 租戶頂層),但名字看不到時仍要顯示欄位 */
  hasOwner: boolean;
  ability: OrgActionAbility;
  /** 租戶頂層對租戶內的人:停用 / 刪除 / 搬移停用並提示(ADR-0009) */
  isTenantTopProtected: boolean;
  /** 根組織視角 + 租戶頂層 + 有 `tenant-ops.revoke-provision` 才給「撤銷開通」(#374) */
  canRevokeProvision: boolean;
  onEdit: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  onRevokeProvision: () => void;
}

/**
 * 右欄資料區(Figma OrgDetail 87:244 / 92:724):名稱 + 狀態標籤 + 動作列,底下逐列的組織資料。
 * 商標只在有值時出現(`logoUrl` 是 api 現簽的短效網址,ADR-0010);
 * 擁有者只有租戶頂層有(ADR-0009),其餘組織連欄位都不渲染。
 */
export const OrgDetailPanel = ({
  org,
  isLoading,
  parentName,
  ownerName,
  hasOwner,
  ability,
  isTenantTopProtected,
  canRevokeProvision,
  onEdit,
  onToggleEnabled,
  onDelete,
  onRevokeProvision,
}: OrgDetailPanelProps) => {
  const t = useTranslations("admin.orgManager.detail");

  if (org === undefined) {
    return (
      <Card
        component="section"
        aria-label={t("region")}
        sx={{ flex: 1, minWidth: 0, minHeight: 0, p: 3, overflow: "auto" }}
      >
        <Stack sx={{ alignItems: "center", py: 4 }}>
          {isLoading ? (
            <CircularProgress aria-label={t("loading")} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t("empty")}
            </Typography>
          )}
        </Stack>
      </Card>
    );
  }

  return (
    <Card
      component="section"
      aria-label={t("region")}
      sx={{ flex: 1, minWidth: 0, minHeight: 0, p: 3, overflow: "auto" }}
    >
      <Stack spacing={0}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", pb: 1.75 }}
        >
          <Typography variant="subtitle1">{org.name}</Typography>
          <Tag
            tone={org.enabled ? "success" : "error"}
            label={org.enabled ? t("enabled") : t("disabled")}
          />
          <Stack sx={{ flex: 1 }} />
          <OrgActionBar
            org={org}
            ability={ability}
            isTenantTopProtected={isTenantTopProtected}
            canRevokeProvision={canRevokeProvision}
            onEdit={onEdit}
            onToggleEnabled={onToggleEnabled}
            onDelete={onDelete}
            onRevokeProvision={onRevokeProvision}
          />
        </Stack>

        <OrgDetailRow label={t("parent")}>
          <Typography variant="body2">{parentName ?? t("none")}</Typography>
        </OrgDetailRow>
        <OrgDetailRow label={t("description")}>
          <Typography variant="body2">
            {org.description ?? t("none")}
          </Typography>
        </OrgDetailRow>
        {org.logoUrl !== null && org.logoUrl !== undefined && (
          <OrgDetailRow label={t("logo")}>
            <Avatar
              variant="rounded"
              src={org.logoUrl}
              alt={t("logoAlt", { name: org.name })}
            />
          </OrgDetailRow>
        )}
        {hasOwner && (
          <OrgDetailRow label={t("owner")}>
            <Typography variant="body2">
              {ownerName ?? t("ownerHidden")}
            </Typography>
          </OrgDetailRow>
        )}
      </Stack>
    </Card>
  );
};
