import type { FactoryProvider, InjectionToken } from "@nestjs/common";
import type { Types } from "mongoose";

import { BaseRepository, type RepositoryDocument } from "./base.repository";
import type { OperatorContext } from "./operator-context";
import { DatabaseRegistrationError } from "./registration-error";
import { WorkflowTasksRepository } from "./workflow-tasks.repository";
import { WorkflowsRepository } from "./workflows.repository";

/** 組織歸屬欄:一般租戶資料是 `orgId`;歸屬租戶頂層的底座表(forms)是 `ownerOrgId`。 */
export type OrgOwnerField = "orgId" | "ownerOrgId";

/** 能回答「這個組織名下還有沒有資料」的 repository(BaseRepository 的存在性檢查)。 */
export interface OrgOwnedDataRepository {
  existsAny(
    operator: OperatorContext,
    ownerField: OrgOwnerField,
    orgId: Types.ObjectId,
  ): Promise<boolean>;
}

/** 一項組織歸屬檢查(由資料登記組裝而來):哪張表、哪個 repository、看哪個歸屬欄。 */
export interface OrgDataCheckBinding {
  readonly key: string;
  readonly modelName: string;
  readonly collection: string;
  readonly repository: InjectionToken<OrgOwnedDataRepository>;
  readonly ownerField: OrgOwnerField;
}

type AnyBaseRepository = BaseRepository<unknown, RepositoryDocument>;

interface BoundOrgDataCheck {
  readonly key: string;
  readonly repository: AnyBaseRepository;
  readonly ownerField: OrgOwnerField;
}

/**
 * 以「已驗過的組織」為條件問「有沒有」時用的上下文:兩個範圍提升為 `"all"`。
 * 業務 collection 吃**可見範圍**,而刪除 / 撤銷的資格吃**管理範圍**(ADR-0005 的分工),兩者不一定重疊:
 * 用操作者自己的可見範圍去數,管得到但看不到那個組織的人會數到 0,把還掛著資料的組織誤判成可刪。
 * 這份上下文只在本檔內使用,查詢條件固定釘在歸屬欄 = 該組織,不交給任何登記方的程式。
 */
function existenceContext(operator: OperatorContext): OperatorContext {
  return { ...operator, visibleOrgIds: "all", managedOrgIds: "all" };
}

/**
 * 「這個組織名下還有沒有業務資料」的唯一判斷點:刪除組織與撤銷開通共用
 * (`OrgsService.orgContentReasons`,docs/modules/org-manager.md「刪除」)。
 *
 * 清單 = 資料登記宣告的每一項組織歸屬檢查(底座的 customers、兩張示範表、fields、forms、
 * form_submissions、workflow_instances,加上專案登記的每張租戶表),再加兩張以 `tenantId`
 * 為邊界的底座表(workflows / workflow_tasks,只有租戶頂層會命中)。
 * `audit_logs` 刻意不算 —— 那是只增不改的歷史紀錄(ADR-0004),不是被引用的業務資料。
 *
 * 登記的檢查一律走 `BaseRepository` 的存在性檢查:條件釘在歸屬欄、略過資料範圍規則(ADR-0008),
 * 規則把資料從操作者眼前收掉時仍答「有」。不接受自訂 callback / filter;任何一項查詢失敗就整個拋出,
 * 不當成「沒有資料」。
 */
export class OrgBusinessDataReader {
  constructor(
    private readonly checks: readonly BoundOrgDataCheck[],
    private readonly tasks: WorkflowTasksRepository,
    private readonly workflows: WorkflowsRepository,
  ) {}

  async hasBusinessData(
    operator: OperatorContext,
    orgId: Types.ObjectId,
  ): Promise<boolean> {
    const reader = existenceContext(operator);
    const found = await Promise.all([
      // 固定呼叫 BaseRepository 本身的實作:子類覆寫不了這一步,也拿不到提升過的上下文
      ...this.checks.map((check) =>
        BaseRepository.prototype.existsAny.call(
          check.repository,
          reader,
          check.ownerField,
          orgId,
        ),
      ),
      this.tasks.count(orgId, {}).then((count) => count > 0),
      // workflows 的邊界就是 tenantId(不經 BaseRepository),以本組織當邊界查「有沒有任何一筆」
      this.workflows.findOne(orgId, {}).then((workflow) => workflow !== null),
    ]);
    return found.some(Boolean);
  }
}

/**
 * 確認 DI 給的 repository 真的是 `BaseRepository`,而且綁的就是登記宣告的那張表。
 * 錯綁(檢查指到另一張表的 repository)會讓刪組織前置永遠查錯地方,所以啟動時就失敗。
 */
export function assertRepositoryIdentity(
  subject: string,
  repository: unknown,
  expected: { readonly modelName: string; readonly collection: string },
): AnyBaseRepository {
  if (!(repository instanceof BaseRepository)) {
    throw new DatabaseRegistrationError(
      `${subject}:repository 必須是 BaseRepository(model「${expected.modelName}」)`,
    );
  }
  if (
    repository.modelName !== expected.modelName ||
    repository.collectionName !== expected.collection
  ) {
    throw new DatabaseRegistrationError(
      `${subject}:登記的是 model「${expected.modelName}」/ collection「${expected.collection}」,` +
        `repository 實際綁的是「${repository.modelName}」/「${repository.collectionName}」`,
    );
  }
  return repository as AnyBaseRepository;
}

/** `OrgBusinessDataReader` 的 provider:注入各項檢查的 repository,建立前逐一驗證識別。 */
export function orgBusinessDataReaderProvider(
  checks: readonly OrgDataCheckBinding[],
): FactoryProvider<OrgBusinessDataReader> {
  return {
    provide: OrgBusinessDataReader,
    inject: [
      WorkflowTasksRepository,
      WorkflowsRepository,
      ...checks.map((check) => check.repository),
    ],
    useFactory: (
      tasks: WorkflowTasksRepository,
      workflows: WorkflowsRepository,
      ...repositories: unknown[]
    ) =>
      new OrgBusinessDataReader(
        checks.map((check, index) => ({
          key: check.key,
          repository: assertRepositoryIdentity(
            `組織歸屬檢查「${check.key}」`,
            repositories[index],
            check,
          ),
          ownerField: check.ownerField,
        })),
        tasks,
        workflows,
      ),
  };
}
