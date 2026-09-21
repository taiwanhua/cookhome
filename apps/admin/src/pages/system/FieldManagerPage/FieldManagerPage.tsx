import { useState } from "react";
import { useTranslations } from "use-intl";

import { useSetFieldEnabledMutation } from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Stack } from "@repo/ui/stack";

import { useSession } from "@/hooks/useSession";

import { CategoryListPanel } from "./CategoryListPanel";
import { FieldFormDialog } from "./FieldFormDialog/FieldFormDialog";
import { FieldOptionsPanel } from "./FieldOptionsPanel/FieldOptionsPanel";
import { fieldManagerErrorOf } from "./field-manager-error";
import type {
  FieldManagerErrorCode,
  FieldOptionLike,
} from "./field-manager-types";
import { useFieldManagerData } from "./useFieldManagerData";

/**
 * 欄位管理(模組 key `system.field-manager`,正本 `docs/modules/field-manager.md`;
 * Figma「Screen / Admin 欄位管理」90:2、新增選項 211:176)。
 *
 * 左欄是全域種子類別(唯讀),右欄是所選類別的**合併清單** = 全域種子 + 上層組織自訂
 * + 本組織自訂 + 可見範圍內的下層自訂(#264 規則表,正本見上述模組文件)。
 * 一列能做什麼由 api 逐列算好(`canEdit` / `canToggleEnabled`),前端只跟權限取交集;
 * 自訂選項可改 label / order / description,但 `value` 建立後不可改;選項一律不刪、只停用。
 * 解讀集中在 `field-source.ts`,表格與彈窗不自己推組織關係。
 */
export const FieldManagerPage = () => {
  const { session } = useSession();
  const t = useTranslations("admin.fieldManager");
  const data = useFieldManagerData();

  const [editing, setEditing] = useState<FieldOptionLike | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<FieldManagerErrorCode | null>(
    null,
  );
  const [pendingFieldId, setPendingFieldId] = useState<string | null>(null);

  const setFieldEnabled = useSetFieldEnabledMutation(session.client, {
    onSuccess: () => {
      setPendingFieldId(null);
      setActionError(null);
      void data.invalidate();
    },
    onError: (error: unknown) => {
      setPendingFieldId(null);
      setActionError(fieldManagerErrorOf(error));
    },
  });

  /** 停用 / 啟用不另開確認彈窗:可逆,且既有資料不受影響(只影響新填寫)。 */
  const handleToggleEnabled = (field: FieldOptionLike, enabled: boolean) => {
    setActionError(null);
    setPendingFieldId(field.id);
    setFieldEnabled.mutate({ input: { id: field.id, enabled } });
  };

  const closeDialog = () => {
    setIsCreateOpen(false);
    setEditing(null);
  };

  const handleSaved = () => {
    closeDialog();
    setActionError(null);
    void data.invalidate();
  };

  const isDialogOpen = isCreateOpen || editing !== null;

  return (
    // 撐滿殼給的內容區高度(STYLE-08 / Figma 90:214:左右兩塊等高、各自內部捲動)
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
      {actionError !== null && (
        <Alert severity="error">{t(`errors.${actionError}`)}</Alert>
      )}

      <Stack direction="row" spacing={3} sx={{ flex: 1, minHeight: 0 }}>
        <CategoryListPanel
          categories={data.categories}
          isLoading={data.isCategoriesLoading}
          selectedCategoryId={data.selectedCategoryId}
          onSelectCategory={data.selectCategory}
        />
        <FieldOptionsPanel
          category={data.selectedCategory}
          fields={data.fields}
          isLoading={data.isFieldsLoading}
          canCreate={data.canCreate}
          canEdit={data.canEdit}
          canToggleEnabled={data.canToggleEnabled}
          pendingFieldId={pendingFieldId}
          onCreate={() => {
            setActionError(null);
            setIsCreateOpen(true);
          }}
          onEdit={(field) => {
            setActionError(null);
            setEditing(field);
          }}
          onToggleEnabled={handleToggleEnabled}
        />
      </Stack>

      {isDialogOpen && data.selectedCategory !== null && (
        <FieldFormDialog
          categoryId={data.selectedCategory.id}
          categoryName={data.selectedCategory.name}
          {...(editing === null ? {} : { field: editing })}
          onClose={closeDialog}
          onSaved={handleSaved}
        />
      )}
    </Stack>
  );
};
