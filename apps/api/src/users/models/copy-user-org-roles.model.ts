import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";

import { UserModel as User, UserOrg } from "./user.model";

/** 複製的方式(`docs/modules/user-manager.md`「複製組織與角色」的集合運算)。 */
export enum CopyUserOrgRolesMode {
  /** 合併:目標原有的全留著,再加上來源的(`final = T ∪ S`)。 */
  MERGE = "MERGE",
  /** 取代:操作者管理範圍內的換成來源的,範圍外的留著(`final = (T − M) ∪ S`)。 */
  REPLACE = "REPLACE",
}

registerEnumType(CopyUserOrgRolesMode, {
  name: "CopyUserOrgRolesMode",
  description: "複製使用者的組織與角色:合併 / 取代",
});

/** 擋下這次複製的原因;與同名錯誤碼同義(正式送出時以該錯誤碼拒絕)。 */
export enum CopyUserOrgRolesBlockerCode {
  /** 複製後一個所屬組織都不剩 */
  LAST_ORG = "LAST_ORG",
  /** 取代會把擁有者移出他擁有的組織(`orgId`),或解除他的租戶管理員授予(`roleId`) */
  OWNER_PROTECTED = "OWNER_PROTECTED",
  /** 要新授予的角色已停用(`roleId`) */
  ROLE_DISABLED = "ROLE_DISABLED",
  /** 以複製後的所屬組織判斷,仍沒有該角色的授予資格(`roleId`) */
  USER_NOT_ELIGIBLE = "USER_NOT_ELIGIBLE",
}

registerEnumType(CopyUserOrgRolesBlockerCode, {
  name: "CopyUserOrgRolesBlockerCode",
  description: "複製使用者的組織與角色被擋下的原因",
});

/** 一筆擋下原因;`roleId` / `orgId` 依碼擇一有值(`LAST_ORG` 兩者皆無)。 */
@ObjectType()
export class CopyUserOrgRolesBlocker {
  @Field(() => CopyUserOrgRolesBlockerCode)
  code!: CopyUserOrgRolesBlockerCode;

  @Field(() => ID, { nullable: true })
  roleId!: string | null;

  @Field(() => ID, { nullable: true })
  orgId!: string | null;
}

/** 差異裡的一個角色:名稱 + 擁有組織名稱(擁有組織在管理範圍外時為 null)。 */
@ObjectType()
export class CopyUserOrgRolesRole {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  ownerOrgName!: string | null;
}

/** 所屬組織的差異;只列操作者管理範圍內的組織(範圍外的不會被動到,也不露名稱)。 */
@ObjectType()
export class CopyUserOrgRolesOrgDiff {
  @Field(() => [UserOrg])
  added!: UserOrg[];

  @Field(() => [UserOrg])
  removed!: UserOrg[];

  @Field(() => [UserOrg])
  kept!: UserOrg[];
}

/** 角色授予的差異;只列操作者可觸及的角色(範圍外的授予不會被動到)。 */
@ObjectType()
export class CopyUserOrgRolesRoleDiff {
  @Field(() => [CopyUserOrgRolesRole])
  added!: CopyUserOrgRolesRole[];

  @Field(() => [CopyUserOrgRolesRole])
  removed!: CopyUserOrgRolesRole[];

  @Field(() => [CopyUserOrgRolesRole])
  kept!: CopyUserOrgRolesRole[];
}

/**
 * 複製使用者的組織與角色的結果。`dryRun = true` 時只算不寫(`applied = false`、
 * `user` 是目標目前的樣子);正式送出且有差異時 `applied = true`、`user` 是寫入後的樣子。
 */
@ObjectType()
export class CopyUserOrgRolesPayload {
  /** 目標使用者 */
  @Field(() => User)
  user!: User;

  @Field(() => CopyUserOrgRolesMode)
  mode!: CopyUserOrgRolesMode;

  /** 這次有沒有真的寫入(試算、或沒有任何差異時為 false) */
  @Field(() => Boolean)
  applied!: boolean;

  @Field(() => CopyUserOrgRolesOrgDiff)
  orgs!: CopyUserOrgRolesOrgDiff;

  @Field(() => CopyUserOrgRolesRoleDiff)
  roles!: CopyUserOrgRolesRoleDiff;

  /** 非空時正式送出會被拒絕(以第一筆的碼) */
  @Field(() => [CopyUserOrgRolesBlocker])
  blockers!: CopyUserOrgRolesBlocker[];

  /**
   * 取代後,目標持有的某些**操作者觸及不到**的角色會失去授予資格 —— 它們照樣留著
   * (權限邊界外的東西不動),只給畫面一個提示旗標,不逐筆列出。
   */
  @Field(() => Boolean)
  outOfScopeKept!: boolean;
}
