import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { isValidFieldCategoryKey } from "@repo/domain/form";

import { AuditService } from "../audit/audit.service";
import type { Persisted } from "../database/base.repository";
import {
  FieldCategoriesRepository,
  type FieldCategoryDocument,
} from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import { OwnerProtectionService } from "../orgs/owner-protection.service";
import type {
  CreateFieldCategoryInput,
  FieldCategoriesInput,
  SetFieldCategoryEnabledInput,
  UpdateFieldCategoryInput,
} from "./dto/field-category.input";
import {
  fieldCategoryKeyDuplicateError,
  forbiddenError,
  notFoundError,
  validationError,
} from "./fields-error";
import type { FieldCategoriesPayload } from "./models/field-payloads.model";
import type { FieldCategoryModel } from "./models/field.model";

type CategoryRecord = Persisted<FieldCategoryDocument>;

/** 稽核動作名(field-manager.md「稽核」);`targetType` 一律 `field-category`。 */
const AUDIT_TARGET_TYPE = "field-category";
const AUDIT_CREATE = "field-category.create";
const AUDIT_UPDATE = "field-category.update";
const AUDIT_SET_ENABLED = "field-category.set-enabled";

/** MongoDB 唯一索引衝突;唯一索引與事前檢查之間的競態由它兜底。 */
const DUPLICATE_KEY_ERROR = 11_000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY_ERROR
  );
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw validationError(`${field} must not be empty`, [field]);
  }
  return trimmed;
}

/** 說明:空白視同沒寫(`null`)。 */
function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

export function toCategoryModel(category: CategoryRecord): FieldCategoryModel {
  return {
    id: String(category._id),
    key: category.key,
    name: category.name,
    description: category.description ?? null,
    isSystem: category.isSystem,
    enabled: category.enabled,
  };
}

/**
 * 欄位類別(`system.field-manager` 的左欄;正本 `docs/modules/field-manager.md`)。
 *
 * 類別有兩個來源:seed 宣告的**系統類別**(`isSystem: true`,跨環境同步)與 root 在畫面新增的類別
 * (`isSystem: false`,只在該環境);seed 宣告同 key 時認養後者(ADR-0002)。
 *
 * 寫入(新增 / 改名 / 停用)是**根組織專屬**:權限 `system.field-manager.category-ops.manage-categories`
 * 掛在 isRootOnly 的權限容器下(模板扣除),再加「站在根組織」—— 與租戶作業同一個判斷點
 * (`OwnerProtectionService.isRootOperator`),權限可能經角色被帶到別的組織。
 * 類別不可刪、`key` 建立後不可改(表單定義以 key 引用);系統類別在畫面完全唯讀(不可改名 / 說明、不可停用;
 * 名稱與說明由 seed 維護,改了下次部署也會被蓋回去)。
 */
@Injectable()
export class FieldCategoriesService {
  constructor(
    private readonly categories: FieldCategoriesRepository,
    private readonly ownerProtection: OwnerProtectionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * 類別清單,依建立順序(系統類別 = seed 宣告順序,畫面建的排在後面)。
   * `enabledOnly` 給表單設計器的類別下拉用;欄位管理頁要看得到停用的類別。
   */
  async list(
    operator: OperatorContext,
    input: FieldCategoriesInput | null | undefined,
  ): Promise<FieldCategoriesPayload> {
    const found = await this.categories.findMany(
      operator,
      input?.enabledOnly === true ? { enabled: true } : {},
      { sort: { createdAt: 1, _id: 1 } },
    );
    const items = found.map((category) => toCategoryModel(category));
    return { items, totalCount: items.length };
  }

  async create(
    operator: OperatorContext,
    input: CreateFieldCategoryInput,
  ): Promise<FieldCategoryModel> {
    await this.assertRootOperator(operator, AUDIT_CREATE);
    const key = input.key.trim();
    if (!isValidFieldCategoryKey(key)) {
      throw validationError(`key is not a valid field category key: ${key}`, [
        "key",
      ]);
    }
    const name = requireText(input.name, "name");
    const description = optionalText(input.description);
    if (await this.categories.findOne(operator, { key })) {
      throw fieldCategoryKeyDuplicateError(
        `field category key already exists: ${key}`,
      );
    }
    let created: CategoryRecord;
    try {
      created = await this.categories.create(operator, {
        key,
        name,
        ...(description === null ? {} : { description }),
        isSystem: false,
        enabled: true,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw fieldCategoryKeyDuplicateError(
          `field category key already exists: ${key}`,
        );
      }
      throw error;
    }
    await this.audit.record(operator, {
      action: AUDIT_CREATE,
      targetType: AUDIT_TARGET_TYPE,
      targetId: created._id,
      after: { key, name, description },
    });
    return toCategoryModel(created);
  }

  /** 改名 / 說明;系統類別唯讀(`SYSTEM_CATEGORY`)—— 名稱 / 說明由 seed 維護。 */
  async update(
    operator: OperatorContext,
    input: UpdateFieldCategoryInput,
  ): Promise<FieldCategoryModel> {
    await this.assertRootOperator(operator, AUDIT_UPDATE);
    const current = await this.mustFind(operator, input.id);
    if (current.isSystem) {
      throw forbiddenError(
        `system field category is read-only: ${current.key}`,
        "SYSTEM_CATEGORY",
      );
    }
    const set: Record<string, unknown> = {};
    const unset: Record<string, string> = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    if (input.name !== undefined && input.name !== null) {
      set.name = requireText(input.name, "name");
      before.name = current.name;
      after.name = set.name;
    }
    if (input.description !== undefined) {
      const description = optionalText(input.description);
      before.description = current.description ?? null;
      after.description = description;
      if (description === null) {
        unset.description = "";
      } else {
        set.description = description;
      }
    }
    if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
      // 什麼都沒送(或送的值與現況無從比較的缺席):不寫入、不記稽核
      return toCategoryModel(current);
    }
    const updated = await this.categories.updateById(operator, current._id, {
      ...(Object.keys(set).length > 0 ? { $set: set } : {}),
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
    });
    if (!updated) {
      throw notFoundError(`field category not found: ${input.id}`);
    }
    await this.audit.record(operator, {
      action: AUDIT_UPDATE,
      targetType: AUDIT_TARGET_TYPE,
      targetId: updated._id,
      before,
      after,
    });
    return toCategoryModel(updated);
  }

  /** 停用 / 啟用;系統類別不可停用(`SYSTEM_CATEGORY`),啟用照常(認養時可能帶著停用狀態)。 */
  async setEnabled(
    operator: OperatorContext,
    input: SetFieldCategoryEnabledInput,
  ): Promise<FieldCategoryModel> {
    await this.assertRootOperator(operator, AUDIT_SET_ENABLED);
    const current = await this.mustFind(operator, input.id);
    if (current.isSystem && !input.enabled) {
      throw forbiddenError(
        `system field category cannot be disabled: ${current.key}`,
        "SYSTEM_CATEGORY",
      );
    }
    if (current.enabled === input.enabled) {
      // 已是目標狀態:冪等,不寫入、不記稽核
      return toCategoryModel(current);
    }
    const updated = await this.categories.updateById(operator, current._id, {
      $set: { enabled: input.enabled },
    });
    if (!updated) {
      throw notFoundError(`field category not found: ${input.id}`);
    }
    await this.audit.record(operator, {
      action: AUDIT_SET_ENABLED,
      targetType: AUDIT_TARGET_TYPE,
      targetId: updated._id,
      before: { enabled: current.enabled },
      after: { enabled: input.enabled },
    });
    return toCategoryModel(updated);
  }

  // ---- 內部 ----

  private async mustFind(
    operator: OperatorContext,
    id: string,
  ): Promise<CategoryRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw validationError(`id is not a valid id: ${id}`, ["id"]);
    }
    const found = await this.categories.findById(
      operator,
      new Types.ObjectId(id),
    );
    if (!found) {
      throw notFoundError(`field category not found: ${id}`);
    }
    return found;
  }

  /** 判準是 `OwnerProtectionService.canActAsRoot`(與租戶作業、資料範圍共用一份)。 */
  private async assertRootOperator(
    operator: OperatorContext,
    action: string,
  ): Promise<void> {
    if (!(await this.ownerProtection.canActAsRoot(operator))) {
      throw forbiddenError(
        `${action} is only available from the root org`,
        "ROOT_ONLY",
      );
    }
  }
}
