import { Field, ID, ObjectType } from "@nestjs/graphql";

/** 所屬組織的摘要(只給操作者可見範圍內的組織,ADR-0005)。 */
@ObjectType()
export class UserOrg {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;
}

/**
 * 一筆角色授予(`user_role`)在畫面上的樣子:角色 + 擁有組織 + 「組織外」標記。
 * `outOfScope` = 使用者的所屬組織皆不在該角色擁有組織的子樹內(ADR-0003「失去資格」的同一判斷);
 * 白話文案(「使用者不在該角色的所屬組織內」)由前端依此旗標顯示,不從 api 傳。
 */
@ObjectType()
export class UserRoleGrant {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  /** 角色的擁有組織(`org_role`);資料損毀而查無擁有組織時為 null。 */
  @Field(() => ID, { nullable: true })
  ownerOrgId!: string | null;

  /** 擁有組織名稱;不在操作者可見範圍內時為 null(只露 id,不露名稱)。 */
  @Field(() => String, { nullable: true })
  ownerOrgName!: string | null;

  @Field(() => Boolean)
  outOfScope!: boolean;
}

/**
 * 使用者(`system.user-manager` 的主要型別)。
 * `passwordHash` 不進 schema;`nationalId` 只有 `user(id)` 且持 `show-national-id` 時才有值
 * (清單一律不顯示,ADR-0007 欄位級加密 + 預設投影排除)。
 */
@ObjectType("User")
export class UserModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  account!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;

  @Field(() => String, { nullable: true })
  nickname!: string | null;

  @Field(() => String, { nullable: true })
  gender!: string | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  address!: string | null;

  /** 身分證字號(ADR-0007):無 `system.user-manager.show-national-id` 一律 null。 */
  @Field(() => String, { nullable: true })
  nationalId!: string | null;

  @Field(() => Boolean)
  enabled!: boolean;

  /** 首登須改密碼(`users.settings.mustChangePassword`;初始密碼建立者為 true)。 */
  @Field(() => Boolean)
  mustChangePassword!: boolean;

  /** 所屬組織(`org_user`),只列操作者可見範圍內的。 */
  @Field(() => [UserOrg])
  orgs!: UserOrg[];

  /** 角色授予(`user_role`),含「組織外」標記。 */
  @Field(() => [UserRoleGrant])
  roles!: UserRoleGrant[];
}
