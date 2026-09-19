import { useTranslations } from "use-intl";

import { Checkbox } from "@repo/ui/checkbox";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { type ModuleRow, isIndeterminate } from "./module-selection";

/** 每一層縮排(Figma 202:363 的 28px;與 theme.spacing(3.5) 同值)。 */
const INDENT = 3.5;

export interface ModuleCheckListProps {
  rows: readonly ModuleRow[];
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string, isChecked: boolean) => void;
  isDisabled: boolean;
}

/**
 * 開放模組勾選區(Figma 202:351):清單來自 `tenantModuleOptions`(= 租戶管理員模板綁的模組,
 * 根組織專屬的已被種子扣除),**預設全勾**;勾選連動見 `module-selection.ts`。
 */
export const ModuleCheckList = ({
  rows,
  selectedIds,
  onToggle,
  isDisabled,
}: ModuleCheckListProps) => {
  const t = useTranslations("admin.orgManager.provision");

  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {t("modules")}
      </Typography>
      {rows.map(({ option, depth }) => (
        <FormControlLabel
          key={option.id}
          sx={{ ml: depth * INDENT }}
          control={
            <Checkbox
              checked={selectedIds.has(option.id)}
              indeterminate={isIndeterminate(selectedIds, rows, option.id)}
              disabled={isDisabled}
              onChange={(event) => {
                onToggle(option.id, event.target.checked);
              }}
            />
          }
          label={option.name}
        />
      ))}
      <Typography variant="caption" color="text.secondary">
        {t("modulesHint")}
      </Typography>
    </Stack>
  );
};
