import { Field, ID, Int, ObjectType, registerEnumType } from "@nestjs/graphql";

/** 側欄呈現型別(module.schema.ts MODULE_SIDEBAR_TYPES;GQL-01 enum 值 SCREAMING_SNAKE_CASE)。 */
export enum ModuleSidebarType {
  GROUP = "group",
  LINK = "link",
  HIDDEN = "hidden",
}

registerEnumType(ModuleSidebarType, {
  name: "ModuleSidebarType",
  description:
    "側欄呈現型別:GROUP=可展開群組(非連結)、LINK=模組連結、HIDDEN=隱藏頁(有路由但不出現在側欄)",
});

/**
 * `me.modules` 的一筆(ADR-0011 步驟 7):前端以 parentId 組樹、以 route 組「可進入路由集合」、
 * 以 permissions 組全域權限結構。
 */
@ObjectType()
export class MeModule {
  @Field(() => ID)
  id!: string;

  /** 模組 key(累加父 key,ADR-0004)。 */
  @Field(() => String)
  key!: string;

  @Field(() => String)
  name!: string;

  /** 上層模組 id;頂層為 null。 */
  @Field(() => ID, { nullable: true })
  parentId!: string | null;

  @Field(() => ModuleSidebarType)
  sidebarType!: ModuleSidebarType;

  /** 同層側欄排序。 */
  @Field(() => Int)
  order!: number;

  /**
   * 完整路徑(父段累加、以 `/` 開頭,如 `/demo/sub/sample-one/edit-page`);
   * 隱藏頁與群組亦然。非頁面的節點(隱藏 `api` 樹)沒有路由 → null。
   */
  @Field(() => String, { nullable: true })
  route!: string | null;

  /** 此模組的有效權限 key(含 wildcard 展開後同層全部;含 `<key>.*` 本身)。 */
  @Field(() => [String])
  permissions!: string[];
}
