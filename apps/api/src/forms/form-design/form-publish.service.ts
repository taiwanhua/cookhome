import { Injectable } from "@nestjs/common";

import { AuditService } from "../../audit/audit.service";
import {
  FormVersionsRepository,
  FormsRepository,
} from "../../database/database.module";
import type { OperatorContext } from "../../database/operator-context";
import {
  FormAccessService,
  type FormOperatorFacts,
  type FormRecord,
} from "../form-access.service";
import type { FormVersionRecord } from "../form-mapper";
import {
  conflictError,
  definitionInvalidError,
  isDuplicateKeyError,
  validationError,
} from "../forms-error";
import type {
  FormKeyInput,
  PublishFormVersionInput,
} from "./dto/form-design.input";
import { FormDefinitionChecker } from "./form-definition-checker";
import { FormFieldPermissionsService } from "./form-field-permissions.service";
import { FormPublishHooks } from "./form-publish-hooks";

/** 稽核動作名(`docs/modules/forms.md`「稽核」)。 */
export const FORM_VERSION_AUDIT = {
  createDraft: "form-version.create-draft",
  saveDraft: "form-version.save-draft",
  publish: "form-version.publish",
  retryPublish: "form-version.retry-publish",
  retire: "form-version.retire",
} as const;

export const FORM_VERSION_TARGET = "form_version";

/** 發布中斷的判定結果:要接續完成的那一版;沒有中斷為 null。 */
export interface PublishState {
  interrupted: FormVersionRecord | null;
}

/**
 * 四步發布(Spec 6a §6「發布」)。**不用 Mongo 交易**(ADR-0007 / ADR-0009:本機與 CI 單節點),
 * 只靠條件更新防重複、靠冪等步驟防中斷:
 *
 * 1. 跑檢查器,有錯就停(什麼都沒改)
 * 2. 條件更新 `{ status: "draft", draftRevision: 預期 } → publishing`,同時配正式版號(最大 + 1)、記 changelog;
 *    沒更新到 → 409(兩個發布同時來只有一個搶得到)
 * 3. 欄位級權限:缺的建、有 `retiredAt` 的復活、不再宣告的退役、`name` 隨 label
 * 4. 切換三筆,依序逐筆寫:這一版 `publishing → published` → 前一版 `published → retired` →
 *    `forms.currentVersion` 指向新版(填寫者只看 `currentVersion`,最後一筆寫完前看到的仍是舊版)
 *
 * 任何一步失敗,資料就停在那一步做到一半的樣子;`retryPublishFormVersion` 從步驟 3 起**重跑全部步驟**,
 * 每個寫入先看「已經是目標狀態就跳過」,重跑幾次結果都一樣。
 */
@Injectable()
export class FormPublishService {
  constructor(
    private readonly forms: FormsRepository,
    private readonly versions: FormVersionsRepository,
    private readonly access: FormAccessService,
    private readonly checker: FormDefinitionChecker,
    private readonly fieldPermissions: FormFieldPermissionsService,
    private readonly hooks: FormPublishHooks,
    private readonly audit: AuditService,
  ) {}

  /**
   * 發布中斷 = 有 `publishing` 版本,或有 `published` 版本但它不是 `currentVersion`
   * (步驟 4 的第一筆寫了、最後一筆沒寫)。有中斷時禁止開草稿 / 退役 / 再發布。
   */
  async stateOf(
    operator: OperatorContext,
    form: FormRecord,
  ): Promise<PublishState> {
    const candidates = await this.versions.findMany(
      operator,
      { formKey: form.key, status: { $in: ["publishing", "published"] } },
      { sort: { version: -1 } },
    );
    const publishing = candidates.find(
      (candidate) => candidate.status === "publishing",
    );
    if (publishing) {
      return { interrupted: publishing };
    }
    const dangling = candidates.find(
      (candidate) => candidate.version !== form.currentVersion,
    );
    return { interrupted: dangling ?? null };
  }

  /** 發布進行中(或中斷)→ `CONFLICT`(`PUBLISH_IN_PROGRESS`)。 */
  async assertNotPublishing(
    operator: OperatorContext,
    form: FormRecord,
  ): Promise<void> {
    const { interrupted } = await this.stateOf(operator, form);
    if (interrupted) {
      throw conflictError(
        `Form ${form.key} has an unfinished publish (version ${String(interrupted.version)})`,
        "PUBLISH_IN_PROGRESS",
      );
    }
  }

  async publish(
    facts: FormOperatorFacts,
    input: PublishFormVersionInput,
  ): Promise<FormVersionRecord> {
    const operator = facts.operator;
    const form = await this.access.requireWritableForm(facts, input.formKey);
    const changelog = input.changelog.trim();
    if (changelog === "") {
      throw validationError("changelog is required", ["changelog"]);
    }
    await this.assertNotPublishing(operator, form);
    const draft = await this.versions.findOne(operator, {
      formKey: form.key,
      status: "draft",
    });
    if (!draft) {
      throw conflictError(`Form ${form.key} has no draft`, "DRAFT_MISSING");
    }
    if (draft.draftRevision !== input.expectedDraftRevision) {
      throw conflictError(
        `Draft revision mismatch: expected ${String(input.expectedDraftRevision)}, actual ${String(draft.draftRevision)}`,
        "DRAFT_REVISION_MISMATCH",
      );
    }

    // 步驟 1:檢查器
    const report = await this.checker.check(operator, form, {
      fields: draft.fields,
      layout: draft.layout,
      summaryMap: draft.summaryMap,
      prefills: draft.prefills,
    });
    if (report.errors.length > 0) {
      throw definitionInvalidError(
        `Form ${form.key} draft has ${String(report.errors.length)} definition error(s)`,
        report.errors,
      );
    }

    // 步驟 2:搶鎖並配版號(草稿還是讀到的那一份才改;兩個發布同時來只有一個命中)
    const [latest] = await this.versions.findMany(
      operator,
      { formKey: form.key, version: { $ne: null } },
      { sort: { version: -1 }, limit: 1 },
    );
    const nextVersion = (latest?.version ?? 0) + 1;
    let locked: FormVersionRecord | null;
    try {
      locked = await this.versions.findOneAndUpdate(
        operator,
        {
          _id: draft._id,
          status: "draft",
          draftRevision: input.expectedDraftRevision,
        },
        { $set: { status: "publishing", version: nextVersion, changelog } },
      );
    } catch (error) {
      // 同版號已被另一個發布配走(唯一索引):視同沒搶到
      if (isDuplicateKeyError(error)) {
        locked = null;
      } else {
        throw error;
      }
    }
    if (!locked) {
      throw conflictError(
        `Form ${form.key} draft was changed or is being published`,
        "DRAFT_REVISION_MISMATCH",
      );
    }
    await this.audit.record(operator, {
      action: FORM_VERSION_AUDIT.publish,
      targetType: FORM_VERSION_TARGET,
      targetId: locked._id,
      after: { formKey: form.key, version: nextVersion, changelog },
    });
    return this.finish(operator, form, locked);
  }

  /** 從步驟 3 冪等重跑;沒有中斷的發布 → `CONFLICT`(`PUBLISH_NOT_INTERRUPTED`)。 */
  async retry(
    facts: FormOperatorFacts,
    input: FormKeyInput,
  ): Promise<FormVersionRecord> {
    const operator = facts.operator;
    const form = await this.access.requireWritableForm(facts, input.formKey);
    const { interrupted } = await this.stateOf(operator, form);
    if (!interrupted) {
      throw conflictError(
        `Form ${form.key} has no interrupted publish`,
        "PUBLISH_NOT_INTERRUPTED",
      );
    }
    await this.audit.record(operator, {
      action: FORM_VERSION_AUDIT.retryPublish,
      targetType: FORM_VERSION_TARGET,
      targetId: interrupted._id,
      after: { formKey: form.key, version: interrupted.version },
    });
    return this.finish(operator, form, interrupted);
  }

  /** 步驟 3、4;每一筆寫入都「已是目標狀態就跳過」。 */
  private async finish(
    operator: OperatorContext,
    form: FormRecord,
    target: FormVersionRecord,
  ): Promise<FormVersionRecord> {
    const version = target.version;
    if (version === null) {
      throw new Error(`發布中的版本沒有版號(formKey=${form.key})`);
    }
    // 步驟 3:欄位級權限(`name` 用表單現在的名稱)
    await this.fieldPermissions.syncForVersion(operator, form, target.fields);

    // 步驟 4a:這一版 publishing → published
    let published = target;
    if (target.status === "publishing") {
      await this.hooks.reached("publish-version");
      published =
        (await this.versions.findOneAndUpdate(
          operator,
          { _id: target._id, status: "publishing" },
          {
            $set: {
              status: "published",
              publishedAt: new Date(),
              publishedBy: operator.actorId,
            },
          },
        )) ?? target;
    }

    // 步驟 4b:前一個(或殘留的)published → retired
    const previous = await this.versions.findMany(operator, {
      formKey: form.key,
      status: "published",
      _id: { $ne: target._id },
    });
    for (const record of previous) {
      await this.hooks.reached("retire-previous");
      await this.versions.findOneAndUpdate(
        operator,
        { _id: record._id, status: "published" },
        { $set: { status: "retired" } },
      );
    }

    // 步驟 4c:currentVersion 指向新版(最後一筆;寫完填寫者才看到新版)
    if (form.currentVersion !== version) {
      await this.hooks.reached("current-version");
      await this.forms.updateById(operator, form._id, {
        $set: { currentVersion: version },
      });
    }
    return published;
  }
}
