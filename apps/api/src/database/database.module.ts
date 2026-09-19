import { Injectable, Module } from "@nestjs/common";
import { InjectModel, MongooseModule, getModelToken } from "@nestjs/mongoose";
import type { HydratedDocument, Model } from "mongoose";

import { BaseRepository, type RepositoryModel } from "./base.repository";
import { RelationService } from "./relation.service";
import { ActionToken, ActionTokenSchema } from "./schemas/action-token.schema";
import { AuditLog, AuditLogSchema } from "./schemas/audit-log.schema";
import {
  CoreRelationship,
  CoreRelationshipSchema,
} from "./schemas/core-relationship.schema";
import { Customer, CustomerSchema } from "./schemas/customer.schema";
import {
  DataScopeRule,
  DataScopeRuleSchema,
} from "./schemas/data-scope-rule.schema";
import {
  DataScopeTarget,
  DataScopeTargetSchema,
} from "./schemas/data-scope-target.schema";
import {
  DemoItemOne,
  DemoItemOneSchema,
} from "./schemas/demo-item-one.schema";
import {
  DemoItemTwo,
  DemoItemTwoSchema,
} from "./schemas/demo-item-two.schema";
import { Field, FieldSchema } from "./schemas/field.schema";
import { Module as ModuleEntity, ModuleSchema } from "./schemas/module.schema";
import { Org, OrgSchema } from "./schemas/org.schema";
import { Permission, PermissionSchema } from "./schemas/permission.schema";
import {
  RefreshToken,
  RefreshTokenSchema,
} from "./schemas/refresh-token.schema";
import { Role, RoleSchema } from "./schemas/role.schema";
import { User, UserSchema } from "./schemas/user.schema";

export type UserDocument = HydratedDocument<User>;
export type OrgDocument = HydratedDocument<Org>;
export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export type ActionTokenDocument = HydratedDocument<ActionToken>;
export type RoleDocument = HydratedDocument<Role>;
export type ModuleDocument = HydratedDocument<ModuleEntity>;
export type PermissionDocument = HydratedDocument<Permission>;
export type AuditLogDocument = HydratedDocument<AuditLog>;
export type CustomerDocument = HydratedDocument<Customer>;
export type DataScopeRuleDocument = HydratedDocument<DataScopeRule>;
export type DataScopeTargetDocument = HydratedDocument<DataScopeTarget>;
export type DemoItemOneDocument = HydratedDocument<DemoItemOne>;
export type DemoItemTwoDocument = HydratedDocument<DemoItemTwo>;
export type FieldDocument = HydratedDocument<Field>;

/** users(關聯歸屬資料:所屬組織走 org_user,資料層不自動過濾,ADR-0005)。 */
@Injectable()
export class UsersRepository extends BaseRepository<User, UserDocument> {
  constructor(
    @InjectModel(User.name) model: RepositoryModel<User, UserDocument>,
  ) {
    super(model);
  }
}

/** orgs(以自身 _id 判定可見,ADR-0005)。 */
@Injectable()
export class OrgsRepository extends BaseRepository<Org, OrgDocument> {
  constructor(@InjectModel(Org.name) model: RepositoryModel<Org, OrgDocument>) {
    super(model);
  }
}

/** refresh_tokens(屬帳號、非租戶資料,ADR-0003)。 */
@Injectable()
export class RefreshTokensRepository extends BaseRepository<
  RefreshToken,
  RefreshTokenDocument
> {
  constructor(
    @InjectModel(RefreshToken.name)
    model: RepositoryModel<RefreshToken, RefreshTokenDocument>,
  ) {
    super(model);
  }
}

/** action_tokens(啟用信 / 重設密碼的單次 token;屬帳號、非租戶資料,ADR-0009)。 */
@Injectable()
export class ActionTokensRepository extends BaseRepository<
  ActionToken,
  ActionTokenDocument
> {
  constructor(
    @InjectModel(ActionToken.name)
    model: RepositoryModel<ActionToken, ActionTokenDocument>,
  ) {
    super(model);
  }
}
/** roles(關聯歸屬資料:擁有組織走 org_role,資料層不自動過濾,ADR-0005)。 */
@Injectable()
export class RolesRepository extends BaseRepository<Role, RoleDocument> {
  constructor(
    @InjectModel(Role.name) model: RepositoryModel<Role, RoleDocument>,
  ) {
    super(model);
  }
}

/** modules(全域資料:模組樹種子,不受租戶過濾,ADR-0005)。 */
@Injectable()
export class ModulesRepository extends BaseRepository<
  ModuleEntity,
  ModuleDocument
> {
  constructor(
    @InjectModel(ModuleEntity.name)
    model: RepositoryModel<ModuleEntity, ModuleDocument>,
  ) {
    super(model);
  }
}

/** permissions(全域資料:權限種子,moduleId 指向擁有模組,ADR-0004)。 */
@Injectable()
export class PermissionsRepository extends BaseRepository<
  Permission,
  PermissionDocument
> {
  constructor(
    @InjectModel(Permission.name)
    model: RepositoryModel<Permission, PermissionDocument>,
  ) {
    super(model);
  }
}

/**
 * audit_logs(租戶資料:orgId = 動作發生的組織脈絡,ADR-0005)。
 * 只增不改(ADR-0004)由 schema 的中介層保證(audit-log.schema.ts):
 * 經此 repository 的 `updateById` / `updateMany` / `softDeleteById` 一律以 AuditLogImmutableError 拒絕。
 */
@Injectable()
export class AuditLogsRepository extends BaseRepository<
  AuditLog,
  AuditLogDocument
> {
  constructor(
    @InjectModel(AuditLog.name)
    model: RepositoryModel<AuditLog, AuditLogDocument>,
  ) {
    super(model);
  }
}

/**
 * 業務資料(租戶資料,`orgId` 指向所屬組織):目前只有「這個組織還有沒有資料掛著」的用途 —
 * 組織刪除前置的第四項(docs/modules/org-manager.md「刪除」)。各自的功能模組長出來時直接沿用。
 */
@Injectable()
export class CustomersRepository extends BaseRepository<
  Customer,
  CustomerDocument
> {
  constructor(
    @InjectModel(Customer.name)
    model: RepositoryModel<Customer, CustomerDocument>,
  ) {
    super(model);
  }
}

/** data_scope_rules(根組織專屬設定:每個資料目標一份規則,ADR-0008;不掛 tenantScope)。 */
@Injectable()
export class DataScopeRulesRepository extends BaseRepository<
  DataScopeRule,
  DataScopeRuleDocument
> {
  constructor(
    @InjectModel(DataScopeRule.name)
    model: RepositoryModel<DataScopeRule, DataScopeRuleDocument>,
  ) {
    super(model);
  }
}

/** data_scope_targets(全表種子資料:模組 seed 宣告的資料目標,ADR-0008)。 */
@Injectable()
export class DataScopeTargetsRepository extends BaseRepository<
  DataScopeTarget,
  DataScopeTargetDocument
> {
  constructor(
    @InjectModel(DataScopeTarget.name)
    model: RepositoryModel<DataScopeTarget, DataScopeTargetDocument>,
  ) {
    super(model);
  }
}

/** demo_items_one(第 5 段示範模組的業務資料)。 */
@Injectable()
export class DemoItemsOneRepository extends BaseRepository<
  DemoItemOne,
  DemoItemOneDocument
> {
  constructor(
    @InjectModel(DemoItemOne.name)
    model: RepositoryModel<DemoItemOne, DemoItemOneDocument>,
  ) {
    super(model);
  }
}

/** demo_items_two(第 5 段示範模組的業務資料)。 */
@Injectable()
export class DemoItemsTwoRepository extends BaseRepository<
  DemoItemTwo,
  DemoItemTwoDocument
> {
  constructor(
    @InjectModel(DemoItemTwo.name)
    model: RepositoryModel<DemoItemTwo, DemoItemTwoDocument>,
  ) {
    super(model);
  }
}

/** fields(欄位選項:`orgId` null = 全域種子、有值 = 租戶自訂,ADR-0005)。 */
@Injectable()
export class FieldsRepository extends BaseRepository<Field, FieldDocument> {
  constructor(
    @InjectModel(Field.name) model: RepositoryModel<Field, FieldDocument>,
  ) {
    super(model);
  }
}

/**
 * 資料層的 Nest 接線:把 BaseRepository 子類與 RelationService 註冊為 provider,
 * 功能模組只注入這些出口,不直接拿 Model(ESLint `@repo/no-raw-model-query`,ADR-0005)。
 * 新 collection 要給功能模組用時,在此加一個 Repository 子類並匯出。
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Org.name, schema: OrgSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: ActionToken.name, schema: ActionTokenSchema },
      { name: Role.name, schema: RoleSchema },
      { name: ModuleEntity.name, schema: ModuleSchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: CoreRelationship.name, schema: CoreRelationshipSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: DataScopeRule.name, schema: DataScopeRuleSchema },
      { name: DataScopeTarget.name, schema: DataScopeTargetSchema },
      { name: DemoItemOne.name, schema: DemoItemOneSchema },
      { name: DemoItemTwo.name, schema: DemoItemTwoSchema },
      { name: Field.name, schema: FieldSchema },
    ]),
  ],
  providers: [
    UsersRepository,
    OrgsRepository,
    RefreshTokensRepository,
    ActionTokensRepository,
    RolesRepository,
    ModulesRepository,
    PermissionsRepository,
    AuditLogsRepository,
    CustomersRepository,
    DataScopeRulesRepository,
    DataScopeTargetsRepository,
    DemoItemsOneRepository,
    DemoItemsTwoRepository,
    FieldsRepository,
    {
      provide: RelationService,
      inject: [getModelToken(CoreRelationship.name)],
      useFactory: (model: Model<CoreRelationship>) =>
        new RelationService(model),
    },
  ],
  exports: [
    UsersRepository,
    OrgsRepository,
    RefreshTokensRepository,
    ActionTokensRepository,
    RolesRepository,
    ModulesRepository,
    PermissionsRepository,
    AuditLogsRepository,
    CustomersRepository,
    DataScopeRulesRepository,
    DataScopeTargetsRepository,
    DemoItemsOneRepository,
    DemoItemsTwoRepository,
    FieldsRepository,
    RelationService,
  ],
})
export class DatabaseModule {}
