import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useFieldCategoriesQuery, useFieldsQuery } from "@repo/graphql";

import { useMe } from "@/hooks/useMe";
import { usePermissions } from "@/hooks/usePermissions";
import { useSession } from "@/hooks/useSession";

import {
  FIELD_MANAGER_PERMISSIONS,
  isRootPerspective,
} from "./field-manager-permissions";
import type {
  FieldCategoryLike,
  FieldOptionLike,
} from "./field-manager-types";

/**
 * 欄位管理頁的資料層:類別清單、選中類別的合併清單、權限判斷與失效。
 *
 * 兩個查詢串起來(類別 → 該類別的選項),所以選中的類別 id 在還沒點過任何一列時
 * 取第一個類別(在 render 期間推導,不在 effect 內 setState,REACT-06)。
 */
export const useFieldManagerData = () => {
  const { session } = useSession();
  const { hasPermission } = usePermissions();
  const me = useMe();
  const queryClient = useQueryClient();

  const canCreate = hasPermission(FIELD_MANAGER_PERMISSIONS.create);
  const canEdit = hasPermission(FIELD_MANAGER_PERMISSIONS.edit);
  const canToggleEnabled = hasPermission(
    FIELD_MANAGER_PERMISSIONS.toggleEnabled,
  );

  /** 來源欄的「<組織名稱> 自訂」取 session 的當前組織名(api 不傳組織名,GQL-07)。 */
  const currentOrgName = me.data?.me.currentOrg?.name ?? "";
  const isRoot = isRootPerspective(
    me.data?.me.modules.map((module) => module.key),
  );

  const [pickedCategoryId, setPickedCategoryId] = useState<string | null>(null);

  const categoriesQuery = useFieldCategoriesQuery(session.client);
  const categories: readonly FieldCategoryLike[] =
    categoriesQuery.data?.fieldCategories.items ?? [];

  const firstCategoryId = categories.at(0)?.id ?? null;
  const selectedCategoryId = pickedCategoryId ?? firstCategoryId;
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;

  const fieldsQuery = useFieldsQuery(
    session.client,
    { categoryId: selectedCategoryId ?? "" },
    { enabled: selectedCategoryId !== null },
  );
  const fields: readonly FieldOptionLike[] =
    fieldsQuery.data?.fields.items ?? [];

  /**
   * 寫入成功後精準失效(DATA-02 / 04):只有當前類別的選項清單會變 ——
   * 類別本身是種子、不會因為這頁的任何動作而改,`me` 也不受影響(欄位選項不進側欄)。
   */
  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: useFieldsQuery.getKey({
        categoryId: selectedCategoryId ?? "",
      }),
    });
  };

  return {
    canCreate,
    canEdit,
    canToggleEnabled,
    currentOrgName,
    isRoot,
    categories,
    isCategoriesLoading: categoriesQuery.isLoading,
    selectedCategoryId,
    selectedCategory,
    selectCategory: setPickedCategoryId,
    fields,
    isFieldsLoading: fieldsQuery.isLoading,
    invalidate,
  };
};
