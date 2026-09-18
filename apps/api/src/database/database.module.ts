import { Injectable, Module } from "@nestjs/common";
import { InjectModel, MongooseModule, getModelToken } from "@nestjs/mongoose";
import type { HydratedDocument, Model } from "mongoose";

import { BaseRepository, type RepositoryModel } from "./base.repository";
import { RelationService } from "./relation.service";
import { ActionToken, ActionTokenSchema } from "./schemas/action-token.schema";
import {
  CoreRelationship,
  CoreRelationshipSchema,
} from "./schemas/core-relationship.schema";
import {
  Module as ModuleEntity,
  ModuleSchema,
} from "./schemas/module.schema";
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
      { name: CoreRelationship.name, schema: CoreRelationshipSchema },
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
    RelationService,
  ],
})
export class DatabaseModule {}
