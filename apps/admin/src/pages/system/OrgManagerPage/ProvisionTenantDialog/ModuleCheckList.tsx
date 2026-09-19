import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
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
        // 縮排用外層 Box 的 **padding**,不能用直接子元素的 `ml`:
        // `Stack spacing` 會對每個直接子元素下 `& > :not(style):not(style) { margin: 0 }`,
        // 那條選擇器的優先序高過子元素自己的 `sx`,`ml` 會被歸零 —
        // 這就是 #183 驗收看到「勾選清單沒有縮排」的原因。
        // `data-depth` 讓測試不必去讀計算後的樣式就能斷言層級。
        <Box
          key={option.id}
          data-depth={depth}
          sx={{ pl: depth * INDENT, display: "flex" }}
        >
          <FormControlLabel
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
        </Box>
      ))}
      <Typography variant="caption" color="text.secondary">
        {t("modulesHint")}
      </Typography>
    </Stack>
  );
};
