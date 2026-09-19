import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { AuditService } from "../audit/audit.service";
import type { Persisted } from "../database/base.repository";
import {
  FieldCategoriesRepository,
  type FieldCategoryDocument,
  type FieldDocument,
  FieldsRepository,
} from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import type { CreateFieldInput } from "./dto/create-field.input";
import type { SetFieldEnabledInput } from "./dto/set-field-enabled.input";
import type { UpdateFieldInput } from "./dto/update-field.input";
import {
  fieldValueDuplicateError,
  forbiddenError,
  notFoundError,
  validationError,
} from "./fields-error";
import type { FieldCategoryModel } from "./models/field.model";
import { FieldModel, FieldSource } from "./models/field.model";

type FieldRecord = Persisted<FieldDocument>;
type CategoryRecord = Persisted<FieldCategoryDocument>;

/** 審計動作名(field-manager.md「審計動作」);`targetType` 一律 `field`。 */
const AUDIT_TARGET_TYPE = "field";
const AUDIT_CREATE = "field.create";
const AUDIT_EDIT = "field.edit";
const AUDIT_TOGGLE_ENABLED = "field.toggle-enabled";

/** MongoDB 唯一索引衝突;唯一索引與表單驗證之間的競態由它兜底。 */
const DUPLICATE_KEY_ERROR = 11_000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY_ERROR
  );
}

function toObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw validationError(`${field} is not a valid id: ${value}`, [field]);
  }
  return new Types.ObjectId(value);
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw validationError(`${field} must not be empty`, [field]);
  }
  return trimmed;
}

/**
 * 欄位管理(`system.field-manager`)。resolver 薄、service 厚(STRUCT-01)。
 *
 * **合併清單的定義**(field-manager.md「api 介面」):一個類別下看得到的選項 =
 * 全域種子(`orgId = null`)+ **當前組織**自訂(`orgId = currentOrgId`)。
 * 只吃當前組織、不吃整個可見範圍 — 否則根組織操作者會看到全部租戶的自訂選項,
 * 而畫面上的「來源」欄只分得出「全域 / 本組織自訂」兩種(ADR-0005)。
 *
 * **種子選項**(`isSystem`)只有 `enabled` 可改,且那是**全域**開關(ADR-0002:
 * `enabled` 是初始 seed 值欄位、由人在系統內管理),所以限根組織操作者 —
 * 租戶切它會影響其他租戶,違反租戶隔離。
 */
@Injectable()
export class FieldsService {
  constructor(
    private readonly fields: FieldsRepository,
    private readonly categories: FieldCategoriesRepository,
    private readonly audit: AuditService,
  ) {}

  // ---- 讀 ----

  /** 類別清單(全域種子,租戶不可自訂);依建立順序 = seed 宣告順序。 */
  async listCategories(
    operator: OperatorContext,
  ): Promise<FieldCategoryModel[]> {
    const categories = await this.categories.findMany(
      operator,
      {},
      { sort: { createdAt: 1 } },
    );
    return categories.map((category) => toCategoryModel(category));
  }

  /** 一個類別下的合併清單:全域種子 + 當前組織自訂,依 `order` 再依建立順序。 */
  async listFields(
    operator: OperatorContext,
    categoryId: string,
  ): Promise<FieldModel[]> {
    const category = await this.mustFindCategory(operator, categoryId);
    const items = await this.fields.findMany(
      operator,
      { categoryId: category._id, orgId: { $in: mergedOrgIds(operator) } },
      { sort: { order: 1, createdAt: 1 } },
    );
    return items.map((item) => toFieldModel(item));
  }

  // ---- 寫 ----

  /** 新增當前組織的自訂選項(`orgId` 由 BaseRepository 自當前組織寫入,ADR-0005)。 */
  async create(
    operator: OperatorContext,
    input: CreateFieldInput,
  ): Promise<FieldModel> {
    const category = await this.mustFindCategory(operator, input.categoryId);
    const label = requireText(input.label, "label");
    const value = requireText(input.value, "value");
    await this.assertValueAvailable(operator, category._id, value);
    let created: FieldRecord;
    try {
      created = await this.fields.create(operator, {
        categoryId: category._id,
        label,
        value,
        order: input.order ?? 0,
        enabled: true,
        isSystem: false,
        ...(input.description === undefined || input.description === null
          ? {}
          : { description: input.description }),
      });
    } catch (error) {
      // 唯一索引擋下的競態(兩個請求同時新增同一個 value)
      if (isDuplicateKeyError(error)) {
        throw fieldValueDuplicateError(
          `field value already exists in this category: ${value}`,
        );
      }
      throw error;
    }
    await this.audit.record(operator, {
      action: AUDIT_CREATE,
      targetType: AUDIT_TARGET_TYPE,
      targetId: created._id,
      after: { categoryId: String(category._id), value, label },
    });
    return toFieldModel(created);
  }

  /** 編輯自訂選項的 label / order / description;種子選項 → `FORBIDDEN`(`value` 不在 input 內)。 */
  async update(
    operator: OperatorContext,
    input: UpdateFieldInput,
  ): Promise<FieldModel> {
    const current = await this.mustFindOwnField(operator, input.id);
    const set: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    if (input.label !== undefined) {
      set.label = requireText(input.label, "label");
      before.label = current.label;
    }
    if (input.order !== undefined && input.order !== null) {
      set.order = input.order;
      before.order = current.order;
    }
    const unset: Record<string, string> = {};
    if (input.description !== undefined) {
      before.description = current.description ?? null;
      if (input.description === null) {
        unset.description = "";
      } else {
        set.description = input.description;
      }
    }
    const updated = await this.fields.updateById(operator, current._id, {
      ...(Object.keys(set).length > 0 ? { $set: set } : {}),
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
    });
    if (!updated) {
      throw notFoundError(`field not found: ${input.id}`);
    }
    await this.audit.record(operator, {
      action: AUDIT_EDIT,
      targetType: AUDIT_TARGET_TYPE,
      targetId: updated._id,
      before,
      after: {
        ...set,
        ...(unset.description === undefined ? {} : { description: null }),
      },
    });
    return toFieldModel(updated);
  }

  /**
   * 停用 / 啟用:自訂選項 = 當前組織自己的那筆;
   * 種子選項的 `enabled` 是全域開關,限根組織操作者(見本檔開頭)。
   */
  async setEnabled(
    operator: OperatorContext,
    input: SetFieldEnabledInput,
  ): Promise<FieldModel> {
    const current = await this.mustFindVisibleField(operator, input.id);
    if (current.isSystem || current.orgId === null) {
      if (operator.visibleOrgIds !== "all") {
        throw forbiddenError(
          `seed field option is a global switch; only the root org can toggle it: ${input.id}`,
        );
      }
    } else if (!isOwnedByCurrentOrg(operator, current)) {
      throw forbiddenError(
        `field option belongs to another org: ${input.id}`,
      );
    }
    const updated = await this.fields.updateById(operator, current._id, {
      $set: { enabled: input.enabled },
    });
    if (!updated) {
      throw notFoundError(`field not found: ${input.id}`);
    }
    await this.audit.record(operator, {
      action: AUDIT_TOGGLE_ENABLED,
      targetType: AUDIT_TARGET_TYPE,
      targetId: updated._id,
      before: { enabled: current.enabled },
      after: { enabled: updated.enabled },
    });
    return toFieldModel(updated);
  }

  // ---- 內部 ----

  private async mustFindCategory(
    operator: OperatorContext,
    categoryId: string,
  ): Promise<CategoryRecord> {
    const category = await this.categories.findById(
      operator,
      toObjectId(categoryId, "categoryId"),
    );
    if (!category) {
      throw notFoundError(`field category not found: ${categoryId}`);
    }
    return category;
  }

  /** 取一筆在合併清單裡看得到的選項(全域 或 當前組織自訂)。 */
  private async mustFindVisibleField(
    operator: OperatorContext,
    id: string,
  ): Promise<FieldRecord> {
    const found = await this.fields.findOne(operator, {
      _id: toObjectId(id, "id"),
      orgId: { $in: mergedOrgIds(operator) },
    });
    if (!found) {
      throw notFoundError(`field not found: ${id}`);
    }
    return found;
  }

  /** 取一筆**可編輯**的選項:當前組織自訂;種子與別的組織的一律 `FORBIDDEN`。 */
  private async mustFindOwnField(
    operator: OperatorContext,
    id: string,
  ): Promise<FieldRecord> {
    const found = await this.mustFindVisibleField(operator, id);
    if (found.isSystem || found.orgId === null) {
      throw forbiddenError(
        `seed field option is read-only (only enabled can be changed): ${id}`,
      );
    }
    if (!isOwnedByCurrentOrg(operator, found)) {
      throw forbiddenError(`field option belongs to another org: ${id}`);
    }
    return found;
  }

  /**
   * 同一類別下 value 不可重複:同組織已有(唯一索引)、
   * 或與該類別的**全域**選項相同(索引擋不到 — 全域那筆的 `orgId` 是 null)。
   */
  private async assertValueAvailable(
    operator: OperatorContext,
    categoryId: Types.ObjectId,
    value: string,
  ): Promise<void> {
    const clash = await this.fields.findOne(operator, {
      categoryId,
      value,
      orgId: { $in: mergedOrgIds(operator) },
    });
    if (clash) {
      throw fieldValueDuplicateError(
        `field value already exists in this category: ${value}`,
      );
    }
  }
}

/** 合併清單吃的組織集合:全域(null)+ 當前組織。 */
function mergedOrgIds(operator: OperatorContext): (Types.ObjectId | null)[] {
  return operator.currentOrgId === null
    ? [null]
    : [null, operator.currentOrgId];
}

function isOwnedByCurrentOrg(
  operator: OperatorContext,
  field: FieldRecord,
): boolean {
  return (
    operator.currentOrgId !== null &&
    String(field.orgId) === String(operator.currentOrgId)
  );
}

function toCategoryModel(category: CategoryRecord): FieldCategoryModel {
  return {
    id: String(category._id),
    key: category.key,
    name: category.name,
    description: category.description ?? null,
  };
}

function toFieldModel(field: FieldRecord): FieldModel {
  return {
    id: String(field._id),
    categoryId: String(field.categoryId),
    label: field.label,
    value: field.value,
    order: field.order,
    enabled: field.enabled,
    description: field.description ?? null,
    source: field.orgId === null ? FieldSource.GLOBAL : FieldSource.OWN,
  };
}
