import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";

export interface UserToolbarProps {
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  /** 有 `system.user-manager.create` 才出現「新增使用者」 */
  canCreate: boolean;
  onCreate: () => void;
}

/** 清單工具列(Figma toolbar 31:145):搜尋(姓名或 Email)+ 新增使用者。 */
export const UserToolbar = ({
  keyword,
  onKeywordChange,
  canCreate,
  onCreate,
}: UserToolbarProps) => {
  const t = useTranslations("admin.userManager.toolbar");

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
      <Box sx={{ flex: 1 }} />
      {canCreate && <Button onClick={onCreate}>{t("create")}</Button>}
    </Stack>
  );
};
