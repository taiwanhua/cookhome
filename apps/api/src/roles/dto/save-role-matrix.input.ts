import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 權限矩陣的儲存(role-manager.md 權限表「編輯權限矩陣」):**整份覆蓋**。
 *
 * - 送的是 key(不是 id):矩陣的規則全在 key 上(`*` 同層語意、勾下層補上層),
 *   前端用的 `@repo/domain/permission` 純函式也吃 key,兩邊同一份資料形狀
 * - 後端一律以 `normalizeGrant` 正規化後落庫(`*` 收斂、補上層、樹外丟棄),
 *   所以前端就算少補一層上層模組也不會存出殘缺的樹
 * - 覆蓋範圍 = `roleMatrix` 回的那棵樹(= 操作者授得出去的那棵);樹外的既有綁定不動
 *   (同 `assignUserRoles`「操作者觸及不到的既有授予不動」)
 * - 防越權:送出的授予要是操作者有效權限集的子集,否則 `ROLE_OUT_OF_REACH`(ADR-0004)
 * - 租戶管理員副本:只能縮不能擴,送出的要是目前綁定的子集,否則同樣 `ROLE_OUT_OF_REACH`(ADR-0009)
 */
@InputType()
export class SaveRoleMatrixInput {
  @Field(() => ID)
  roleId!: string;

  /** 勾選的模組 key(`role_module` = 進得去哪些頁,ADR-0011)。 */
  @Field(() => [String])
  moduleKeys!: string[];

  /** 勾選的權限 key(`role_permission`;整組全給時送 `<模組key>.*` 即可,後端也會自行收斂)。 */
  @Field(() => [String])
  permissionKeys!: string[];
}
