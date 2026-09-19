import { FieldSource } from "@repo/graphql";

import type { FieldOptionLike } from "./field-manager-types";

/**
 * 「來源」欄與種子判定集中在這裡(本票唯一一處讀 `Field.source` 的地方)。
 *
 * 目前的語意是「全域 + **當前組織**」兩分(`docs/modules/field-manager.md`「api 介面」)。
 * 可見範圍要不要改成「向下繼承」(看得到上層組織的自訂選項)尚未裁決 —— 真的改了,
 * 要動的只有這個檔:多一種來源、來源欄多一種文案,表格與彈窗不必改。
 */

/** 種子選項(全域):`label` / `order` / `description` 唯讀,只有 `enabled` 能動。 */
export const isSeedOption = (field: FieldOptionLike): boolean =>
  field.source === FieldSource.Global;

/** 來源欄的文案 key 與 Tag 色調;`sourceOwn` 需要帶入當前組織名稱。 */
export interface FieldSourceView {
  labelKey: "sourceGlobal" | "sourceOwn";
  tone: "grey" | "primary";
}

export const fieldSourceView = (field: FieldOptionLike): FieldSourceView =>
  isSeedOption(field)
    ? { labelKey: "sourceGlobal", tone: "grey" }
    : { labelKey: "sourceOwn", tone: "primary" };

/**
 * 這一列的啟用開關能不能動:
 * 種子選項的 `enabled` 是**全域**開關(切下去全平台生效),api 限根組織操作者,
 * 租戶送出會吃 `FORBIDDEN` —— 所以非根視角下種子列唯讀,只有自訂選項可切。
 */
export const canToggleOption = (
  field: FieldOptionLike,
  { canToggleEnabled, isRoot }: { canToggleEnabled: boolean; isRoot: boolean },
): boolean => canToggleEnabled && (isRoot || !isSeedOption(field));

/** 這一列能不能編輯:自訂選項 + 有 `edit` 權限(種子選項連彈窗都不開)。 */
export const canEditOption = (
  field: FieldOptionLike,
  { canEdit }: { canEdit: boolean },
): boolean => canEdit && !isSeedOption(field);
