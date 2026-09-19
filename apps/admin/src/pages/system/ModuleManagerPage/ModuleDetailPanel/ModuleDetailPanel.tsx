import { useTranslations } from "use-intl";

import { ModuleSidebarType } from "@repo/graphql";
import { Box } from "@repo/ui/box";
import { Card } from "@repo/ui/card";
import { CircularProgress } from "@repo/ui/circular-progress";
import { Stack } from "@repo/ui/stack";
import { Switch } from "@repo/ui/switch";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import { isSelfLockedModuleKey } from "../module-manager-permissions";
import type {
  ModuleAdminNodeLike,
  ModuleAdminPermissionLike,
} from "../module-manager-types";
import { ModuleDetailRow } from "./ModuleDetailRow";
import { ModulePermissionTable } from "./ModulePermissionTable";

export interface ModuleDetailPanelProps {
  module: ModuleAdminNodeLike | null;
  isLoading: boolean;
  canToggleEnabled: boolean;
  isModulePending: boolean;
  pendingPermissionId: string | null;
  onToggleModule: (enabled: boolean) => void;
  onTogglePermission: (
    permission: ModuleAdminPermissionLike,
    enabled: boolean,
  ) => void;
}

/** `sidebarType` → 文案 key(三種類型都要看得到,樹上只標群組與隱藏頁)。 */
const SIDEBAR_TYPE_KEY: Record<ModuleSidebarType, string> = {
  [ModuleSidebarType.Group]: "sidebarGroup",
  [ModuleSidebarType.Link]: "sidebarLink",
  [ModuleSidebarType.Hidden]: "sidebarHidden",
};

/**
 * 右欄資料區(Figma ModuleDetail 89:245):名稱 + enabled 開關,底下逐列的模組資料,
 * 再底下是這個模組**這一層**宣告的權限清單。
 *
 * 除 enabled 外全部唯讀 —— 模組樹是種子資料,新增 / 改名 / 搬位置走 code + PR
 * (ADR-0002);這一頁能改的只有「開著還是關著」。
 */
export const ModuleDetailPanel = ({
  module,
  isLoading,
  canToggleEnabled,
  isModulePending,
  pendingPermissionId,
  onToggleModule,
  onTogglePermission,
}: ModuleDetailPanelProps) => {
  const t = useTranslations("admin.moduleManager.detail");

  if (module === null) {
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

  const isSelfLocked = isSelfLockedModuleKey(module.key);

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
          sx={{ alignItems: "center", pb: 1.5 }}
        >
          <Typography variant="subtitle1" sx={{ flex: 1, minWidth: 0 }}>
            {module.name}
          </Typography>
          {canToggleEnabled ? (
            <>
              <Typography variant="body2" color="text.secondary">
                {t("enabled")}
              </Typography>
              <Box
                component="span"
                title={isSelfLocked ? t("selfLockedHint") : undefined}
              >
                <Switch
                  checked={module.enabled}
                  disabled={isSelfLocked || isModulePending}
                  onChange={(_event, checked) => {
                    onToggleModule(checked);
                  }}
                  slotProps={{
                    input: {
                      "aria-label": t("toggleAria", { name: module.name }),
                    },
                  }}
                />
              </Box>
            </>
          ) : (
            <Tag
              tone={module.enabled ? "success" : "error"}
              label={module.enabled ? t("stateEnabled") : t("stateDisabled")}
            />
          )}
        </Stack>

        <ModuleDetailRow label={t("key")}>
          <Typography variant="body2">{module.key}</Typography>
        </ModuleDetailRow>
        <ModuleDetailRow label={t("sidebarType")}>
          <Typography variant="body2">
            {t(SIDEBAR_TYPE_KEY[module.sidebarType])}
          </Typography>
        </ModuleDetailRow>
        <ModuleDetailRow label={t("order")}>
          <Typography variant="body2">{module.order}</Typography>
        </ModuleDetailRow>
        <ModuleDetailRow label={t("description")}>
          <Typography variant="body2">
            {module.description ?? t("none")}
          </Typography>
        </ModuleDetailRow>

        <ModulePermissionTable
          permissions={module.permissions}
          canToggleEnabled={canToggleEnabled}
          isSelfLocked={isSelfLocked}
          pendingPermissionId={pendingPermissionId}
          onTogglePermission={onTogglePermission}
        />
      </Stack>
    </Card>
  );
};
