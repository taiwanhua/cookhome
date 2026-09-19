import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import type { Persisted } from "../database/base.repository";
import {
  DataScopeRulesRepository,
  type DataScopeTargetDocument,
  DataScopeTargetsRepository,
} from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import {
  type DataScopeRuleProvider,
  setDataScopeRuleProvider,
} from "../database/plugins/data-scope-provider";
import { OwnerProtectionService } from "../orgs/owner-protection.service";
import {
  ruleInvalidError,
  rootOnlyError,
  targetNotFoundError,
} from "./data-scope-error";
import {
  type DataScopeField,
  type DataScopeGroupOp,
  type DataScopeOperatorFacts,
  type DataScopeRuleEntry,
  compileRules,
  fieldCatalogOf,
  validateRules,
} from "./data-scope-rule";
import type { SaveDataScopeRuleInput } from "./dto/save-data-scope-rule.input";
import type {
  DataScopeCombineOpEnum,
  DataScopeFieldTypeEnum,
  DataScopeRuleModel,
  DataScopeTargetModel,
} from "./models/data-scope.model";

/** 審計動作名(`docs/modules/data-scope.md`「審計動作」)。 */
const AUDIT_ACTION = "data-scope.edit";
const AUDIT_TARGET_TYPE = "data_scope_rule";

/**
 * 讀 `data_scope_targets` / `data_scope_rules` 用的上下文:兩張表都沒掛 tenantScope
 * (種子表 + 根組織專屬設定),所以兩個範圍在此無作用;只用來讓 BaseRepository 收得到上下文。
 * 規則的讀取發生在**查詢中介層裡**,不能倚賴當下那個操作者的範圍 — 否則變成規則自己被規則過濾。
 */
const RULE_READER: OperatorContext = {
  actorId: null,
  currentOrgId: null,
  visibleOrgIds: "all",
  managedOrgIds: "all",
};

/** 快取中的一份規則:沒有規則的 collection 也要記(`null`),否則每次查詢都打一次資料庫。 */
interface CachedRule {
  combineOp: DataScopeGroupOp;
  rules: DataScopeRuleEntry[];
  /** 編譯時要靠它決定值的型別(org/user → ObjectId、date → Date、enum → 字串)。 */
  catalog: DataScopeField[];
}

type TargetRecord = Persisted<DataScopeTargetDocument>;

/**
 * 資料範圍(`system.data-scope`,ADR-0008)。resolver 薄、service 厚(STRUCT-01)。
 *
 * 兩個職責:
 * 1. **設定面**:資料目標與欄位目錄、讀規則、整份覆蓋儲存(驗證 + 審計 + 作廢快取)
 * 2. **執行面**:實作 `DataScopeRuleProvider`,在 Nest 啟動時註冊給查詢中介層
 *    (`database/plugins/tenant-scope.plugin.ts`),讓每一次業務查詢都在租戶保底之內再套規則
 *
 * **快取**:`Map<collection, CachedRule | null>`,儲存時作廢該 collection(ADR-0008
 * 「設定整包記憶體快取,儲存時作廢」)。**多執行個體的一致性本段不處理** —
 * 同一份規則改動後,其他執行個體要到自己的快取被作廢(重啟)才會跟上;
 * 規則是低頻設定、且各執行個體最終一致,現階段可接受,需要時再上 pub/sub 或短 TTL。
 */
@Injectable()
export class DataScopeService
  implements DataScopeRuleProvider, OnModuleInit, OnModuleDestroy
{
  private readonly cache = new Map<string, CachedRule | null>();

  constructor(
    private readonly rules: DataScopeRulesRepository,
    private readonly targets: DataScopeTargetsRepository,
    private readonly audit: AuditService,
    private readonly ownerProtection: OwnerProtectionService,
  ) {}

  onModuleInit(): void {
    setDataScopeRuleProvider(this);
  }

  onModuleDestroy(): void {
    setDataScopeRuleProvider(undefined);
  }

  // ---- 執行面(查詢中介層) ----

  /**
   * 查詢中介層的唯一入口:回傳要 AND 進查詢的條件,沒有規則命中 → `null`。
   * 命中判斷、動態值代入、combineOp 合成全在 `data-scope-rule.ts`(純函式)。
   */
  async conditionFor(
    collection: string,
    operator: OperatorContext,
  ): Promise<Record<string, unknown> | null> {
    const cached = await this.ruleOf(collection);
    if (!cached) {
      return null;
    }
    return compileRules(
      cached.rules,
      cached.combineOp,
      cached.catalog,
      factsOf(operator),
    );
  }

  private async ruleOf(collection: string): Promise<CachedRule | null> {
    const hit = this.cache.get(collection);
    if (hit !== undefined) {
      return hit;
    }
    const loaded = await this.load(collection);
    this.cache.set(collection, loaded);
    return loaded;
  }

  private async load(collection: string): Promise<CachedRule | null> {
    const document = await this.rules.findOne(RULE_READER, { collection });
    if (!document || document.rules.length === 0) {
      return null;
    }
    const target = await this.targets.findOne(RULE_READER, { collection });
    return {
      combineOp: document.combineOp,
      rules: document.rules as unknown as DataScopeRuleEntry[],
      catalog: fieldCatalogOf(declaredFieldsOf(target)),
    };
  }

  // ---- 設定面(「資料範圍」頁) ----

  /** 資料目標清單(seed);每個目標的欄位目錄已附上底座的基礎欄位(ADR-0008)。 */
  async listTargets(operator: OperatorContext): Promise<DataScopeTargetModel[]> {
    await this.assertRootOperator(operator, "dataScopeTargets");
    const documents = await this.targets.findMany(
      RULE_READER,
      {},
      { sort: { collection: 1 } },
    );
    return documents.map((target) => toTargetModel(target));
  }

  /** 某目標目前的規則;尚未設定過 → `null`(ADR-0008:沒有規則 = 只有租戶保底)。 */
  async findRule(
    operator: OperatorContext,
    collection: string,
  ): Promise<DataScopeRuleModel | null> {
    await this.assertRootOperator(operator, "dataScopeRule");
    await this.mustFindTarget(collection);
    const document = await this.rules.findOne(RULE_READER, { collection });
    if (!document) {
      return null;
    }
    return {
      collection: document.collection,
      combineOp: document.combineOp as DataScopeCombineOpEnum,
      rules: document.rules as unknown as DataScopeRuleModel["rules"],
      updatedAt: document.updatedAt,
    };
  }

  /**
   * 整份覆蓋(ADR-0008):先以該目標的欄位目錄驗「欄位存在 / 運算子符合型別 / 值來源符合型別」,
   * 任一不符 → `RULE_INVALID` 附 `path`;通過才寫入,並**立即作廢該 collection 的快取**。
   */
  async saveRule(
    operator: OperatorContext,
    input: SaveDataScopeRuleInput,
  ): Promise<DataScopeRuleModel> {
    await this.assertRootOperator(operator, AUDIT_ACTION);
    const target = await this.mustFindTarget(input.collection);
    const catalog = fieldCatalogOf(declaredFieldsOf(target));
    const rules = input.rules.map((rule) => ({
      audience: { type: rule.audience.type, ids: rule.audience.ids ?? [] },
      filter: rule.filter,
    }));
    const violation = validateRules(rules, catalog);
    if (violation) {
      throw ruleInvalidError(violation);
    }

    const existing = await this.rules.findOne(RULE_READER, {
      collection: input.collection,
    });
    const before = existing
      ? { combineOp: existing.combineOp, rules: existing.rules }
      : undefined;
    const saved = existing
      ? await this.rules.updateById(RULE_READER, existing._id, {
          $set: { combineOp: input.combineOp, rules },
        })
      : await this.rules.create(RULE_READER, {
          collection: input.collection,
          combineOp: input.combineOp,
          rules,
        });
    if (!saved) {
      throw targetNotFoundError(input.collection);
    }
    // 儲存即作廢(ADR-0008);下一次查詢重新載入
    this.cache.delete(input.collection);
    await this.audit.record(operator, {
      action: AUDIT_ACTION,
      targetType: AUDIT_TARGET_TYPE,
      targetId: saved._id,
      ...(before === undefined ? {} : { before }),
      after: { combineOp: input.combineOp, rules },
    });
    return {
      collection: saved.collection,
      combineOp: saved.combineOp as DataScopeCombineOpEnum,
      rules: saved.rules as unknown as DataScopeRuleModel["rules"],
      updatedAt: saved.updatedAt,
    };
  }

  private async mustFindTarget(collection: string): Promise<TargetRecord> {
    const target = await this.targets.findOne(RULE_READER, { collection });
    if (!target) {
      throw targetNotFoundError(collection);
    }
    return target;
  }

  /**
   * 「資料範圍」是根組織專屬模組(`isRootOnly`,ADR-0008 / docs/modules/data-scope.md):
   * 判準與租戶作業共用 `isRootOperator`(站在哪裡才算,權限可能經角色被帶到別的組織)。
   */
  private async assertRootOperator(
    operator: OperatorContext,
    action: string,
  ): Promise<void> {
    if (
      !(await this.ownerProtection.isRootOperator(operator)) ||
      operator.managedOrgIds !== "all"
    ) {
      throw rootOnlyError(action);
    }
  }
}

/** OperatorContext → 規則比對 / 動態值代入需要的事實(ADR-0008)。 */
function factsOf(operator: OperatorContext): DataScopeOperatorFacts {
  return {
    actorId: operator.actorId,
    memberOrgIds: operator.memberOrgIds ?? [],
    roleIds: operator.roleIds ?? [],
  };
}

/** `data_scope_targets.fields` 是 Mixed(seed 寫入);只取形狀對的欄位宣告。 */
function declaredFieldsOf(target: TargetRecord | null): DataScopeField[] {
  return (target?.fields ?? []) as unknown as DataScopeField[];
}

function toTargetModel(target: TargetRecord): DataScopeTargetModel {
  return {
    collection: target.collection,
    name: target.name,
    description: target.description ?? null,
    fields: fieldCatalogOf(declaredFieldsOf(target)).map((field) => ({
      name: field.name,
      label: field.label,
      type: field.type as DataScopeFieldTypeEnum,
      options: field.options ?? [],
      isBase: field.isBase === true,
    })),
  };
}
