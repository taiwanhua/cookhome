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

/** 頁面組裝方式(module.schema.ts MODULE_ENGINES;GQL-01 enum 值 SCREAMING_SNAKE_CASE)。 */
export enum ModuleEngine {
  FIXED = "fixed",
  FORM = "form",
}

registerEnumType(ModuleEngine, {
  name: "ModuleEngine",
  description:
    "模組頁面怎麼組裝:FIXED=固定欄位模組(手寫頁面)、FORM=表單模組(頁面由表單引擎組裝)",
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

  /**
   * 側欄圖示 key(白名單 `@repo/domain/module-icon`);`null` = 用預設圖示。
   * 值由根組織在「模組與權限」頁管理(`setModuleIcon`),seed 只給初值;
   * 前端以 key 查自己的登錄表(`@repo/ui`),認不得的 key 一律退回預設圖示。
   */
  @Field(() => String, { nullable: true })
  icon!: string | null;

  /** 頁面組裝方式(seed 宣告 `engine: "form"` 才是 FORM);admin 依它掛表單引擎的預設組裝。 */
  @Field(() => ModuleEngine)
  engine!: ModuleEngine;

  /** 此模組的有效權限 key(含 wildcard 展開後同層全部;含 `<key>.*` 本身)。 */
  @Field(() => [String])
  permissions!: string[];
}
