import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

import { ModuleSidebarType } from "../../permission/models/me-module.model";

/**
 * 模組與權限頁右側清單的一筆權限(`docs/modules/module-manager.md`)。
 * 與 `me.modules[].permissions`(只回 key 字串、且只回**有效**的)不同:
 * 治理面要看的是「這個模組宣告了哪些權限、各自開著還是關著」,所以**停用的也回**,
 * 由 `enabled` 表示狀態(ADR-0011 步驟 4 的 kill switch 就是這個欄位)。
 */
@ObjectType()
export class PermissionAdmin {
  @Field(() => ID)
  id!: string;

  /** 權限 key(`<擁有模組key>.<動作>`;`*` 代表該模組這一層的全部,ADR-0004)。 */
  @Field(() => String)
  key!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  /**
   * 全域 kill switch(`permissions.enabled`):false 時**任何人都不再持有它**,
   * 連超級管理員也不給(ADR-0011 步驟 4)。切換 = `setPermissionEnabled`。
   */
  @Field(() => Boolean)
  enabled!: boolean;
}

/**
 * 模組樹的一個節點(`moduleTree`,根組織專屬)。
 *
 * 與 `me.modules` 的差別:`me.modules` 是「**我**進得去哪些頁」(受角色綁定與 enabled 過濾),
 * 這裡是治理面的「平台**宣告**了哪些模組」— 全樹照回,含側欄看不到的 hidden 節點與隱藏的
 * `api` 權限樹,也含已停用的模組與權限;停用與否一律以 `enabled` 表示,不以「不回」表示。
 *
 * `isRootOnly` 只存在於 seed 宣告層、不落庫(`apps/db-migrator/seeds/module-declaration.ts`),
 * 執行期無從得知,故本型別不回該欄位(Spec #201 Interface design 已載明)。
 */
@ObjectType()
export class ModuleAdminNode {
  @Field(() => ID)
  id!: string;

  /** 模組 key(累加父 key,ADR-0004)。 */
  @Field(() => String)
  key!: string;

  @Field(() => String)
  name!: string;

  /** 上層模組 id;本樹的根為 null(`moduleTree` 回的是全樹,根 = 真正的頂層模組)。 */
  @Field(() => ID, { nullable: true })
  parentId!: string | null;

  @Field(() => ModuleSidebarType)
  sidebarType!: ModuleSidebarType;

  /** 同層側欄排序(與 `me.modules` 同一個值)。 */
  @Field(() => Int)
  order!: number;

  @Field(() => String, { nullable: true })
  description!: string | null;

  /**
   * 側欄圖示 key(白名單 `@repo/domain/module-icon`);`null` = 沒指定,側欄用預設圖示。
   * seed 只給初值,執行期由 `setModuleIcon` 改(`enabled` 之外的第二個可變欄位)。
   */
  @Field(() => String, { nullable: true })
  icon!: string | null;

  /**
   * 模組自己的停用狀態。**停用連動整棵子樹**(`setModuleEnabled(enabled: false)` 會把子孫
   * 一起寫成 false),所以樹上每個節點的 `enabled` 都是它自己的真實值,不必再看祖先。
   */
  @Field(() => Boolean)
  enabled!: boolean;

  /** 這個模組這一層宣告的全部權限(含已停用者);`<key>.*` 恆排在最前。 */
  @Field(() => [PermissionAdmin])
  permissions!: PermissionAdmin[];

  /** 下層模組(側欄順序);葉節點為空陣列。 */
  @Field(() => [ModuleAdminNode])
  children!: ModuleAdminNode[];
}

/**
 * `setModuleEnabled` / `setModuleIcon` 的回傳(GQL-02:mutation 一律回 payload type)。
 * 兩個 mutation 共用同一個 payload —— 回的都是「這個模組這一枝的最新狀態」,沒有形狀差異。
 */
@ObjectType()
export class ModuleAdminPayload {
  /** 被切換的模組**及其整棵子樹**(停用時子孫的 `enabled` 已一併更新,前端直接換掉這一枝)。 */
  @Field(() => ModuleAdminNode)
  module!: ModuleAdminNode;
}

/** `setPermissionEnabled` 的回傳(GQL-02)。 */
@ObjectType()
export class PermissionAdminPayload {
  @Field(() => PermissionAdmin)
  permission!: PermissionAdmin;
}
