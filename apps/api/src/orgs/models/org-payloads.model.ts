import { Field, ID, ObjectType } from "@nestjs/graphql";

import { Org } from "./org.model";

/** 寫入類 mutation 的統一回傳(GQL-02):回動作後的組織,前端直接換掉快取那一筆。 */
@ObjectType()
export class OrgPayload {
  @Field(() => Org)
  org!: Org;
}

/** 刪除(軟刪除,ADR-0007):資料已不再出現在樹上,只回被刪的 id。 */
@ObjectType()
export class DeletePayload {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => ID)
  deletedId!: string;
}
