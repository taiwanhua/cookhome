import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

import { DemoItemTwoModel } from "./demo-item-two.model";

/** 單筆的讀取與寫入結果(GQL-02:mutation 一律回 payload type)。 */
@ObjectType()
export class DemoItemTwoPayload {
  @Field(() => DemoItemTwoModel)
  item!: DemoItemTwoModel;
}

/** 清單分頁(GQL-03 的 `items` + `totalCount`;分頁參數用全站現況的 page / pageSize)。 */
@ObjectType()
export class DemoItemsTwoPayload {
  @Field(() => [DemoItemTwoModel])
  items!: DemoItemTwoModel[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;
}

/**
 * 刪除結果(軟刪除,ADR-0007)。
 *
 * 型別名帶模組前綴,是因為 code-first 的型別名全 schema 唯一,`DeletePayload` 已被組織管理用掉
 * (`orgs/models/org-payloads.model.ts`);同理示範模組1 用自己的那一個。
 */
@ObjectType()
export class DeleteDemoItemTwoPayload {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => ID)
  deletedId!: string;
}
