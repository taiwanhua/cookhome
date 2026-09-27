import {
  Injectable,
  Module,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { InjectModel, MongooseModule, getModelToken } from "@nestjs/mongoose";
import type { HydratedDocument, Model } from "mongoose";

import { BaseRepository, type RepositoryModel } from "./base.repository";
import { BusinessRelationshipsRepository } from "./business-relationships.repository";
import { FormSubmissionUsageCounter } from "./form-submission-usage";
import { getDataScopeRuleProvider } from "./plugins/data-scope-provider";
import { RelationService } from "./relation.service";
import { ActionToken, ActionTokenSchema } from "./schemas/action-token.schema";
import { AuditLog, AuditLogSchema } from "./schemas/audit-log.schema";
import {
  BusinessRelationship,
  BusinessRelationshipSchema,
} from "./schemas/business-relationship.schema";
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
import { DemoItemOne, DemoItemOneSchema } from "./schemas/demo-item-one.schema";
import { DemoItemTwo, DemoItemTwoSchema } from "./schemas/demo-item-two.schema";
import {
  FieldCategory,
  FieldCategorySchema,
} from "./schemas/field-category.schema";
import { Field, FieldSchema } from "./schemas/field.schema";
import {
  FormSubmission,
  FormSubmissionSchema,
} from "./schemas/form-submission.schema";
import { FormVersion, FormVersionSchema } from "./schemas/form-version.schema";
import { Form, FormSchema } from "./schemas/form.schema";
import { Module as ModuleEntity, ModuleSchema } from "./schemas/module.schema";
import { Org, OrgSchema } from "./schemas/org.schema";
import { Permission, PermissionSchema } from "./schemas/permission.schema";
import {
  RefreshToken,
  RefreshTokenSchema,
} from "./schemas/refresh-token.schema";
import { Role, RoleSchema } from "./schemas/role.schema";
import { User, UserSchema } from "./schemas/user.schema";
import {
  WorkflowInstance,
  WorkflowInstanceSchema,
} from "./schemas/workflow-instance.schema";
import {
  WorkflowTask,
  WorkflowTaskSchema,
} from "./schemas/workflow-task.schema";
import {
  WorkflowVersion,
  WorkflowVersionSchema,
} from "./schemas/workflow-version.schema";
import { Workflow, WorkflowSchema } from "./schemas/workflow.schema";
import { WorkflowSubmissionStore } from "./workflow-submission-store";
import { WorkflowTasksRepository } from "./workflow-tasks.repository";
import { WorkflowsRepository } from "./workflows.repository";

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
export type FieldCategoryDocument = HydratedDocument<FieldCategory>;
export type FormDocument = HydratedDocument<Form>;
export type FormVersionDocument = HydratedDocument<FormVersion>;
export type FormSubmissionDocument = HydratedDocument<FormSubmission>;
export type WorkflowVersionDocument = HydratedDocument<WorkflowVersion>;
export type WorkflowInstanceDocument = HydratedDocument<WorkflowInstance>;

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

/** field_categories(全域種子:租戶不可自訂,不掛 tenantScope,ADR-0005)。 */
@Injectable()
export class FieldCategoriesRepository extends BaseRepository<
  FieldCategory,
  FieldCategoryDocument
> {
  constructor(
    @InjectModel(FieldCategory.name)
    model: RepositoryModel<FieldCategory, FieldCategoryDocument>,
  ) {
    super(model);
  }
}

/** forms(表單;可見與否由 ownerOrgId + org_form 決定,不掛 tenantScope)。 */
@Injectable()
export class FormsRepository extends BaseRepository<Form, FormDocument> {
  constructor(
    @InjectModel(Form.name) model: RepositoryModel<Form, FormDocument>,
  ) {
    super(model);
  }
}

/** form_versions(表單版本;跟著表單走,不掛 tenantScope)。 */
@Injectable()
export class FormVersionsRepository extends BaseRepository<
  FormVersion,
  FormVersionDocument
> {
  constructor(
    @InjectModel(FormVersion.name)
    model: RepositoryModel<FormVersion, FormVersionDocument>,
  ) {
    super(model);
  }
}

/** form_submissions(模組資料表:可見範圍 + 資料範圍規則依 moduleKey 自動套用)。 */
@Injectable()
export class FormSubmissionsRepository extends BaseRepository<
  FormSubmission,
  FormSubmissionDocument
> {
  constructor(
    @InjectModel(FormSubmission.name)
    model: RepositoryModel<FormSubmission, FormSubmissionDocument>,
  ) {
    super(model);
  }
}

/** workflow_versions(流程版本;跟著流程走,不掛 tenantScope)。 */
@Injectable()
export class WorkflowVersionsRepository extends BaseRepository<
  WorkflowVersion,
  WorkflowVersionDocument
> {
  constructor(
    @InjectModel(WorkflowVersion.name)
    model: RepositoryModel<WorkflowVersion, WorkflowVersionDocument>,
  ) {
    super(model);
  }
}

/**
 * workflow_instances(流程實例;模組資料表,`moduleKey` / `tenantId` 由 plugin 宣告與推導)。
 * 引擎的背景推進與審核者讀取不靠可見範圍(審核者不一定看得到申請人的組織):
 * 呼叫端以明確的租戶邊界條件查,讀取授權走 `canReadSubmissionRevision`。
 */
@Injectable()
export class WorkflowInstancesRepository extends BaseRepository<
  WorkflowInstance,
  WorkflowInstanceDocument
> {
  constructor(
    @InjectModel(WorkflowInstance.name)
    model: RepositoryModel<WorkflowInstance, WorkflowInstanceDocument>,
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
      { name: BusinessRelationship.name, schema: BusinessRelationshipSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: DataScopeRule.name, schema: DataScopeRuleSchema },
      { name: DataScopeTarget.name, schema: DataScopeTargetSchema },
      { name: DemoItemOne.name, schema: DemoItemOneSchema },
      { name: DemoItemTwo.name, schema: DemoItemTwoSchema },
      { name: Field.name, schema: FieldSchema },
      { name: FieldCategory.name, schema: FieldCategorySchema },
      { name: Form.name, schema: FormSchema },
      { name: FormVersion.name, schema: FormVersionSchema },
      { name: FormSubmission.name, schema: FormSubmissionSchema },
      { name: Workflow.name, schema: WorkflowSchema },
      { name: WorkflowVersion.name, schema: WorkflowVersionSchema },
      { name: WorkflowInstance.name, schema: WorkflowInstanceSchema },
      { name: WorkflowTask.name, schema: WorkflowTaskSchema },
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
    FieldCategoriesRepository,
    FormsRepository,
    FormVersionsRepository,
    FormSubmissionsRepository,
    WorkflowVersionsRepository,
    WorkflowInstancesRepository,
    {
      provide: WorkflowsRepository,
      inject: [getModelToken(Workflow.name)],
      useFactory: (model: Model<Workflow>) => new WorkflowsRepository(model),
    },
    {
      provide: WorkflowTasksRepository,
      inject: [getModelToken(WorkflowTask.name)],
      useFactory: (model: Model<WorkflowTask>) =>
        new WorkflowTasksRepository(model),
    },
    {
      provide: WorkflowSubmissionStore,
      inject: [getModelToken(FormSubmission.name)],
      useFactory: (model: Model<FormSubmission>) =>
        new WorkflowSubmissionStore(model),
    },
    {
      provide: FormSubmissionUsageCounter,
      inject: [getModelToken(FormSubmission.name)],
      useFactory: (model: Model<FormSubmission>) =>
        new FormSubmissionUsageCounter(model),
    },
    {
      provide: RelationService,
      inject: [getModelToken(CoreRelationship.name)],
      useFactory: (model: Model<CoreRelationship>) =>
        new RelationService(model),
    },
    {
      provide: BusinessRelationshipsRepository,
      inject: [getModelToken(BusinessRelationship.name)],
      useFactory: (model: Model<BusinessRelationship>) =>
        new BusinessRelationshipsRepository(model),
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
    FieldCategoriesRepository,
    FormsRepository,
    FormVersionsRepository,
    FormSubmissionsRepository,
    FormSubmissionUsageCounter,
    WorkflowSubmissionStore,
    RelationService,
    BusinessRelationshipsRepository,
    WorkflowsRepository,
    WorkflowVersionsRepository,
    WorkflowInstancesRepository,
    WorkflowTasksRepository,
  ],
})
export class DatabaseModule implements OnApplicationBootstrap {
  /**
   * **資料範圍規則的提供者必須在啟動時就註冊好**(#246 的 6)。
   *
   * 查詢中介層找不到 provider 時只套租戶保底(`plugins/tenant-scope.plugin.ts`) ——
   * 那是為了不起 Nest 的單元測試(`base.repository.test.ts`)留的路,但在**跑起來的 app**
   * 裡它等於靜默擴權:規則設了卻沒有人執行,而且不會有任何錯誤。日後把 `DataScopeModule`
   * 從 `AppModule` 拆掉、或改變 `onModuleInit` 的時機都會落進這個洞。
   *
   * 所以在此 fail-fast:`onApplicationBootstrap` 跑在所有 `onModuleInit` 之後
   * (`DataScopeService` 正是在那裡註冊),沒註冊就讓 app 起不來。
   */
  onApplicationBootstrap(): void {
    if (getDataScopeRuleProvider() === undefined) {
      throw new Error(
        "DataScopeRuleProvider 未註冊:AppModule 必須匯入 DataScopeModule,否則資料範圍規則不會被執行(ADR-0008)",
      );
    }
  }
}
