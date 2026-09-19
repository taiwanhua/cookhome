import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";

import { CurrentOperator } from "../auth/decorators";
import type { OperatorContext } from "../database/operator-context";
import { RequirePermission } from "../permission/require-permission.decorator";
import { StorageService } from "../storage/storage.service";
import { CreateChildOrgInput } from "./dto/create-child-org.input";
import { DeleteOrgInput } from "./dto/delete-org.input";
import { MoveOrgInput } from "./dto/move-org.input";
import { SetOrgEnabledInput } from "./dto/set-org-enabled.input";
import { UpdateOrgInput } from "./dto/update-org.input";
import { Org, OrgNode } from "./models/org.model";
import { DeletePayload, OrgPayload } from "./models/org-payloads.model";
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
 * 組織管理的 GraphQL 端點(形式 GQL-02、錯誤 GQL-04):resolver 薄,規則全在 OrgsService。
 * 每個端點以 `@RequirePermission` 守門(ADR-0011「API 防守」:重用頁面權限 key)。
 */
@Resolver(() => Org)
export class OrgsResolver {
  constructor(
    private readonly orgs: OrgsService,
    private readonly storage: StorageService,
  ) {}

  /** 可見範圍內的組織樹;範圍外的節點標 `outOfScope`(ADR-0005)。 */
  @RequirePermission(PERMISSIONS.view)
  @Query(() => [OrgNode])
  orgTree(@CurrentOperator() operator: OperatorContext): Promise<OrgNode[]> {
    return this.orgs.tree(operator);
  }

  @RequirePermission(PERMISSIONS.view)
  @Query(() => Org)
  org(
    @Args("id", { type: () => ID }) id: string,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<Org> {
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
}
