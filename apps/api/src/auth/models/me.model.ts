import { Field, ID, ObjectType } from "@nestjs/graphql";

/** 所屬組織 / 當前組織的摘要(CONTEXT.md 詞彙)。 */
@ObjectType()
export class MeOrg {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;
}

/**
 * `me`:使用者基本資料(不含 passwordHash / nationalId — schema 層就沒有這些欄位)、
 * `mustChangePassword`、當前組織、所屬組織清單。**模組陣列由登入線2(PermissionResolver)補上。**
 */
@ObjectType()
export class Me {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  account!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;

  @Field(() => String, { nullable: true })
  nickname?: string;

  @Field(() => String, { nullable: true })
  gender?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  address?: string;

  /** 首登須改密碼旗標(users.settings.mustChangePassword)。 */
  @Field(() => Boolean)
  mustChangePassword!: boolean;

  /** 當前組織:token 內的組織;登入時預設 = 所屬組織依加入時間第一個。無所屬組織時為 null。 */
  @Field(() => MeOrg, { nullable: true })
  currentOrg!: MeOrg | null;

  /** 所屬組織清單,依加入時間。 */
  @Field(() => [MeOrg])
  orgs!: MeOrg[];
}
