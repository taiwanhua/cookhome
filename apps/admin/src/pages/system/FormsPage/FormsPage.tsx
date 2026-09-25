import { useState } from "react";
import { useTranslations } from "use-intl";

import { Card } from "@repo/ui/card";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { usePermissions } from "@/hooks/usePermissions";

import { FormDetailPanel } from "./FormDetailPanel";
import { CreateFormDialog } from "./FormDialogs/CreateFormDialog";
import { FormListPanel } from "./FormListPanel";
import { FORMS_PERMISSIONS } from "./forms-permissions";
import { useFormsPageData } from "./useFormsPageData";

/**
 * 表單管理(模組 key `system.forms`,正本 `docs/modules/forms.md`;Spec 6a §8 畫面 1–5)。
 * 左欄是表單清單,右欄是選中表單的設計器與版本面板;分派、以此為基底建新表單、編輯名稱是右欄的跳窗。
 *
 * **不是**根組織專屬:root 管共用表單,租戶管理員管自己的客製表單、開關分派來的表單。
 * 「建立表單」只有站在根組織做得到(租戶只能以某版本為基底建客製表單),租戶按了 api 回 `ROOT_ONLY`。
 */
export const FormsPage = () => {
  const t = useTranslations("admin.forms");
  const { hasPermission } = usePermissions();
  const data = useFormsPageData();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <Stack direction="row" spacing={3} sx={{ flex: 1, minHeight: 0 }}>
      <FormListPanel
        forms={data.forms}
        isLoading={data.isLoading}
        keyword={data.keyword}
        onKeywordChange={data.setKeyword}
        selectedKey={data.selectedKey}
        onSelect={data.select}
        canCreate={hasPermission(FORMS_PERMISSIONS.create)}
        onCreate={() => {
          setIsCreating(true);
        }}
      />
      {data.selected === null ? (
        <Card sx={{ flex: 1, p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            {data.isLoading ? t("loading") : t("empty")}
          </Typography>
        </Card>
      ) : (
        <FormDetailPanel
          key={data.selected.key}
          form={data.selected}
          onChanged={() => {
            void data.invalidate(data.selectedKey);
          }}
          onForked={(formKey) => {
            data.select(formKey);
            void data.invalidate(formKey);
          }}
        />
      )}
      {isCreating && (
        <CreateFormDialog
          onClose={() => {
            setIsCreating(false);
          }}
          onCreated={(formKey) => {
            setIsCreating(false);
            data.select(formKey);
            void data.invalidate(formKey);
          }}
        />
      )}
    </Stack>
  );
};
