import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";

import { hasPermission } from "@repo/domain/permission";

import { authError } from "../auth/auth-error";
import { CurrentOperator } from "../auth/decorators";
import type { OperatorContext } from "../database/operator-context";
import { PermissionResolver } from "../permission/permission-resolver";
import { RequirePermission } from "../permission/require-permission.decorator";
import { StorageService } from "../storage/storage.service";
import { CreateChildOrgInput } from "./dto/create-child-org.input";
import { DeleteOrgInput } from "./dto/delete-org.input";
import { MoveOrgInput } from "./dto/move-org.input";
import { SetOrgEnabledInput } from "./dto/set-org-enabled.input";
import { UpdateOrgInput } from "./dto/update-org.input";
import { DeletePayload, OrgPayload } from "./models/org-payloads.model";
import { Org, OrgNode } from "./models/org.model";
import { OrgsService } from "./orgs.service";

/** 權限 key(docs/modules/org-manager.md 權限表;種子 apps/db-migrator/seeds/modules/system.ts)。 */
const PERMISSIONS = {
  view: "system.org-manager.view",
  createChild: "system.org-manager.create-child",
  edit: "system.org-manager.edit",
  toggleEnabled: "system.org-manager.toggle-enabled",
  move: "system.org-manager.move",
  delete: "system.org-manager.delete",
} as const;

/**
 * 「讀組織樹 / 單筆組織」的多選一權限(#139 回饋):
 * 組織樹不只組織管理頁在用 — 使用者管理頁的左樹與「選擇所屬組織」彈窗也要它,
 * 而那些人未必持有組織管理的檢視權。可見範圍(ADR-0005)照樣把關看得到誰,
 * 這裡只決定「進不進得了這個端點」。
 * `@RequirePermission` 是單一 key 的守門,多選一自己查有效權限集合
 * (判斷語意同 PermissionGuard:含同層 wildcard,ADR-0004;寫法同 `storage.resolver.ts`)。
 */
const READ_ORG_PERMISSIONS = [
  PERMISSIONS.view,
  "system.user-manager.view",
] as const;

/**
 * 組織管理的 GraphQL 端點(形式 GQL-02、錯誤 GQL-04):resolver 薄,規則全在 OrgsService。
 * 寫入類端點以 `@RequirePermission` 守門(ADR-0011「API 防守」:重用頁面權限 key);
 * 讀取類的兩個端點是多選一,見 `READ_ORG_PERMISSIONS`。
 */
@Resolver(() => Org)
export class OrgsResolver {
  constructor(
    private readonly orgs: OrgsService,
    private readonly storage: StorageService,
    private readonly permissions: PermissionResolver,
  ) {}

  /** 可見範圍內的組織樹;範圍外的節點標 `outOfScope`(ADR-0005)。 */
  @Query(() => [OrgNode])
  async orgTree(
    @CurrentOperator() operator: OperatorContext,
  ): Promise<OrgNode[]> {
    await this.requireReadPermission(operator);
    return this.orgs.tree(operator);
  }

  @Query(() => Org)
  async org(
    @Args("id", { type: () => ID }) id: string,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<Org> {
    await this.requireReadPermission(operator);
    return this.orgs.one(operator, id);
  }

  /**
   * 商標的短效簽名讀取網址(ADR-0010:DB 存路徑不存 URL,看時現簽);
   * 只在客戶端有問 `logoUrl` 時才簽 — 簽名在 Cloud Run 上是一次 IAM signBlob 呼叫。
   * 可取範圍由 `org` / `orgTree` 的可見範圍把關(呼叫端拿得到這筆資料才問得到網址)。
   */
  @ResolveField(() => String, { nullable: true })
  logoUrl(@Parent() org: Org): Promise<string | null> {
    return this.storage.readUrlOf(org.logoPath);
  }

  @RequirePermission(PERMISSIONS.createChild)
  @Mutation(() => OrgPayload)
  async createChildOrg(
    @Args("input") input: CreateChildOrgInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<OrgPayload> {
    return { org: await this.orgs.createChild(operator, input) };
  }

  @RequirePermission(PERMISSIONS.edit)
  @Mutation(() => OrgPayload)
  async updateOrg(
    @Args("input") input: UpdateOrgInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<OrgPayload> {
    return { org: await this.orgs.update(operator, input) };
  }

  @RequirePermission(PERMISSIONS.toggleEnabled)
  @Mutation(() => OrgPayload)
  async setOrgEnabled(
    @Args("input") input: SetOrgEnabledInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<OrgPayload> {
    return { org: await this.orgs.setEnabled(operator, input) };
  }

  @RequirePermission(PERMISSIONS.move)
  @Mutation(() => OrgPayload)
  async moveOrg(
    @Args("input") input: MoveOrgInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<OrgPayload> {
    return { org: await this.orgs.move(operator, input) };
  }

  @RequirePermission(PERMISSIONS.delete)
  @Mutation(() => DeletePayload)
  deleteOrg(
    @Args("input") input: DeleteOrgInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<DeletePayload> {
    return this.orgs.remove(operator, input);
  }

  /** `READ_ORG_PERMISSIONS` 任一即可;都沒有 → `FORBIDDEN`(語意同 PermissionGuard)。 */
  private async requireReadPermission(
    operator: OperatorContext,
  ): Promise<void> {
    if (!operator.actorId) {
      // 防呆:全域 guard 已擋掉未登入,這裡只是讓型別與 PermissionGuard 一致
      throw authError("UNAUTHENTICATED", "Reading orgs requires a login");
    }
    const { permissionKeys } = await this.permissions.resolve(
      operator.actorId,
      operator.currentOrgId,
    );
    if (
      !READ_ORG_PERMISSIONS.some((key) => hasPermission(permissionKeys, key))
    ) {
      throw authError(
        "FORBIDDEN",
        `Missing permission to read orgs(${READ_ORG_PERMISSIONS.join(" / ")})`,
      );
    }
  }
}
