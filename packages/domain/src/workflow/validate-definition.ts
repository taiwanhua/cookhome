import { FIELD_KEY_PATTERN } from "../form/keys";
import type { FieldDef } from "../form/types";
import { assigneeFieldProblem, skipWhenProblems } from "./form-refs";
import { hasEdges } from "./graph";
import {
  WorkflowIssueCollector,
  type WorkflowIssueLocation,
  type WorkflowValidationReport,
} from "./issues";
import {
  APPROVAL_MODES,
  ASSIGNEE_KINDS,
  type ReviewStepDef,
  STEP_KINDS,
  type StepDef,
  type WorkflowDefinition,
  isJoinStep,
} from "./types";
import { validateWorkflowStructure } from "./validate-structure";

/** 使用者目錄的一筆(只放本租戶的使用者;不在目錄裡 = 不存在或不在本租戶)。 */
export interface WorkflowUserFact {
  isEnabled: boolean;
}

export interface ValidateWorkflowOptions {
  /** 共用流程(`ownerOrgId = null`):不准 `users`、`role` 只能當佔位。 */
  isShared: boolean;
  /** 本租戶的角色 id;不給就不檢查 `ROLE_NOT_IN_TENANT`。 */
  tenantRoleIds?: ReadonlySet<string>;
  /** 本租戶使用者目錄;不給就不出 `USER_INVALID`。 */
  users?: ReadonlyMap<string, WorkflowUserFact>;
  /**
   * 表單 key → 該表單**目前版本**的欄位(`null` = 表單存在但沒有目前版本);
   * map 裡沒有的 key = 表單不存在。不給就不檢查 `field` 來源的表單與欄位。
   */
  forms?: ReadonlyMap<string, readonly FieldDef[] | null>;
  /**
   * 設計器選的「檢查用表單」目前版本的欄位:`skipWhen` 對它驗。
   * 不給時改用定義裡第一個 `field` 來源的表單;兩者都沒有 → 只檢查表達式形狀。
   */
  checkFormFields?: readonly FieldDef[] | null;
  /**
   * 設計器選的「檢查用表單」key 對不到可用的表單(不存在、看不到或沒有目前版本):出一筆
   * `CHECK_FORM_UNAVAILABLE`,跳過條件只檢查形狀 —— 不拿別張表單硬比,免得冒出一堆 `SKIP_UNKNOWN_FIELD`。
   */
  unavailableCheckFormKey?: string;
}

/**
 * 流程定義檢查器(Spec §5「定義檢查器」):發布前跑,設計器即時也跑。**有錯不能發布,警告可發布**。
 * 有 `edges` 的版本另跑結構檢查;沒有 `edges` 的版本只允許審核關卡、不做結構檢查。
 */
export function validateWorkflowDefinition(
  definition: WorkflowDefinition,
  options: ValidateWorkflowOptions,
): WorkflowValidationReport {
  const collector = new WorkflowIssueCollector();
  const { steps } = definition;
  if (steps.length === 0) {
    collector.error("WORKFLOW_EMPTY", "流程至少要有一個關卡", {});
    return { errors: collector.errors, warnings: collector.warnings };
  }
  checkKeys(steps, collector);
  const isGraph = hasEdges(definition);
  if (options.unavailableCheckFormKey !== undefined) {
    collector.error(
      "CHECK_FORM_UNAVAILABLE",
      `檢查用表單 ${options.unavailableCheckFormKey} 不存在、看不到或還沒有發布版本,跳過條件無法對照欄位`,
      { property: "checkFormKey" },
    );
  }
  const skipFields =
    options.unavailableCheckFormKey === undefined
      ? skipWhenFieldsOf(definition, options)
      : null;
  for (const [stepIndex, step] of steps.entries()) {
    const location: WorkflowIssueLocation = { stepKey: step.key, stepIndex };
    if (!(STEP_KINDS as readonly string[]).includes(step.kind ?? "review")) {
      collector.error(
        "STEP_KIND_UNKNOWN",
        `關卡 ${step.key} 的種類不明`,
        location,
      );
      continue;
    }
    if (isJoinStep(step)) {
      checkJoin(step, isGraph, collector, location);
      continue;
    }
    checkReviewStep(step, options, skipFields, collector, location);
  }
  const reviewSteps = steps.filter((step) => !isJoinStep(step));
  if (
    reviewSteps.length > 0 &&
    reviewSteps.every(
      (step) =>
        !isJoinStep(step) &&
        step.skipWhen !== undefined &&
        step.skipWhen !== null,
    )
  ) {
    collector.warn(
      "ALL_STEPS_SKIPPABLE",
      "所有關卡都設了跳過條件,可能整張單不經任何人審核就完成",
      {},
    );
  }
  if (isGraph) {
    validateWorkflowStructure(steps, definition.edges, collector);
  }
  return { errors: collector.errors, warnings: collector.warnings };
}

/** step key:格式同欄位 key、版本內唯一。 */
function checkKeys(
  steps: readonly StepDef[],
  collector: WorkflowIssueCollector,
): void {
  const seen = new Set<string>();
  for (const [stepIndex, step] of steps.entries()) {
    const location = { stepKey: step.key, stepIndex, property: "key" };
    if (!FIELD_KEY_PATTERN.test(step.key)) {
      collector.error(
        "STEP_KEY_FORMAT",
        `關卡 key ${step.key} 格式不符(小寫開頭,只允許小寫、數字、底線,最長 40)`,
        location,
      );
    }
    if (seen.has(step.key)) {
      collector.error(
        "STEP_KEY_DUPLICATE",
        `關卡 key ${step.key} 重複`,
        location,
      );
    }
    seen.add(step.key);
  }
}

/** 匯合節點:只在有 `edges` 的版本出現,且不帶審核關卡的屬性。 */
function checkJoin(
  step: StepDef,
  isGraph: boolean,
  collector: WorkflowIssueCollector,
  location: WorkflowIssueLocation,
): void {
  if (!isGraph) {
    collector.error(
      "JOIN_IN_LINEAR",
      `直線流程不能有匯合節點(${step.key})`,
      location,
    );
  }
  const extra = ["assignee", "mode", "skipWhen", "allowReturn"].filter(
    (property) =>
      property in step &&
      (step as unknown as Record<string, unknown>)[property] !== undefined &&
      (step as unknown as Record<string, unknown>)[property] !== null,
  );
  if (extra.length > 0) {
    collector.error(
      "JOIN_HAS_REVIEW_PROPS",
      `匯合節點 ${step.key} 不能設定 ${extra.join("、")}`,
      { ...location, property: extra[0] },
    );
  }
}

function checkReviewStep(
  step: ReviewStepDef,
  options: ValidateWorkflowOptions,
  skipFields: readonly FieldDef[] | null,
  collector: WorkflowIssueCollector,
  location: WorkflowIssueLocation,
): void {
  if (!(APPROVAL_MODES as readonly string[]).includes(step.mode)) {
    collector.error("MODE_INVALID", `關卡 ${step.key} 的會簽模式不明`, {
      ...location,
      property: "mode",
    });
  }
  checkAssignee(step, options, collector, location);
  if (step.skipWhen !== undefined && step.skipWhen !== null) {
    for (const problem of skipWhenProblems(step.skipWhen, skipFields)) {
      const code = {
        UNKNOWN_OPERATOR: "SKIP_UNKNOWN_OPERATOR",
        INVALID: "SKIP_INVALID",
        UNKNOWN_FIELD: "SKIP_UNKNOWN_FIELD",
        PROTECTED_FIELD: "SKIP_PROTECTED_FIELD",
      } as const;
      collector.error(
        code[problem.problem],
        `關卡 ${step.key} 的跳過條件:${problem.detail}`,
        { ...location, property: "skipWhen", exprPath: problem.path },
      );
    }
  }
}

function checkAssignee(
  step: ReviewStepDef,
  options: ValidateWorkflowOptions,
  collector: WorkflowIssueCollector,
  location: WorkflowIssueLocation,
): void {
  const { assignee } = step;
  const at = (property: string): WorkflowIssueLocation => ({
    ...location,
    property: `assignee.${property}`,
  });
  if (!(ASSIGNEE_KINDS as readonly string[]).includes(assignee.kind)) {
    collector.error(
      "ASSIGNEE_KIND_UNKNOWN",
      `關卡 ${step.key} 的審核者來源不明`,
      at("kind"),
    );
    return;
  }
  switch (assignee.kind) {
    case "users": {
      if (options.isShared) {
        collector.error(
          "USERS_IN_SHARED",
          `共用流程不能指定使用者(關卡 ${step.key})`,
          at("userIds"),
        );
        return;
      }
      checkUsers(step, assignee.userIds, options, collector, at);
      return;
    }
    case "role": {
      checkRole(step, assignee, options, collector, at);
      return;
    }
    case "field": {
      checkFieldSource(step, assignee, options, collector, at);
      return;
    }
    case "manager": {
      if (!Number.isInteger(assignee.level) || assignee.level < 1) {
        collector.error(
          "MANAGER_LEVEL_INVALID",
          `關卡 ${step.key} 的主管層級必須是正整數`,
          at("level"),
        );
      }
      return;
    }
  }
}

/** 指定使用者:不存在 / 不在本租戶 / 已停用 → 警告(發布後解析時會被略過)。 */
function checkUsers(
  step: ReviewStepDef,
  userIds: readonly string[],
  options: ValidateWorkflowOptions,
  collector: WorkflowIssueCollector,
  at: (property: string) => WorkflowIssueLocation,
): void {
  const { users } = options;
  if (users === undefined) {
    return;
  }
  for (const userId of userIds) {
    const fact = users.get(userId);
    if (fact?.isEnabled !== true) {
      collector.warn(
        "USER_INVALID",
        fact === undefined
          ? `關卡 ${step.key} 指定的使用者 ${userId} 不存在或不在本租戶`
          : `關卡 ${step.key} 指定的使用者 ${userId} 已停用`,
        at("userIds"),
      );
    }
  }
}

function checkRole(
  step: ReviewStepDef,
  assignee: { roleId: string | null; placeholder: string | null },
  options: ValidateWorkflowOptions,
  collector: WorkflowIssueCollector,
  at: (property: string) => WorkflowIssueLocation,
): void {
  const hasRoleId = assignee.roleId !== null && assignee.roleId !== "";
  if (options.isShared) {
    if ((assignee.placeholder ?? "").trim() === "") {
      collector.error(
        "ROLE_PLACEHOLDER_MISSING",
        `共用流程的角色來源要填佔位名稱(關卡 ${step.key})`,
        at("placeholder"),
      );
    }
    if (hasRoleId) {
      collector.error(
        "ROLE_ID_IN_SHARED",
        `共用流程的角色來源只能當佔位,不能指到角色(關卡 ${step.key})`,
        at("roleId"),
      );
    }
    return;
  }
  if (!hasRoleId) {
    collector.error(
      "ROLE_ID_MISSING",
      `關卡 ${step.key} 要選本租戶的角色`,
      at("roleId"),
    );
    return;
  }
  if (
    options.tenantRoleIds !== undefined &&
    !options.tenantRoleIds.has(assignee.roleId ?? "")
  ) {
    collector.error(
      "ROLE_NOT_IN_TENANT",
      `關卡 ${step.key} 選的角色不是本租戶的角色`,
      at("roleId"),
    );
  }
}

function checkFieldSource(
  step: ReviewStepDef,
  assignee: { formKey: string; fieldKey: string },
  options: ValidateWorkflowOptions,
  collector: WorkflowIssueCollector,
  at: (property: string) => WorkflowIssueLocation,
): void {
  if (options.forms === undefined) {
    return;
  }
  if (!options.forms.has(assignee.formKey)) {
    collector.error(
      "FIELD_FORM_MISSING",
      `關卡 ${step.key} 的審核者欄位所屬表單 ${assignee.formKey} 不存在`,
      at("formKey"),
    );
    return;
  }
  const fields = options.forms.get(assignee.formKey) ?? [];
  const problem = assigneeFieldProblem(fields, assignee.fieldKey);
  if (problem !== null) {
    collector.error(
      problem,
      problem === "FIELD_MISSING"
        ? `關卡 ${step.key} 的審核者欄位 ${assignee.fieldKey} 不在表單 ${assignee.formKey} 的目前版本`
        : `關卡 ${step.key} 的審核者欄位 ${assignee.fieldKey} 不是使用者型引用欄`,
      at("fieldKey"),
    );
  }
}

/** `skipWhen` 要對照的表單欄位:檢查用表單優先,否則第一個 `field` 來源的表單目前版本。 */
function skipWhenFieldsOf(
  definition: WorkflowDefinition,
  options: ValidateWorkflowOptions,
): readonly FieldDef[] | null {
  if (
    options.checkFormFields !== undefined &&
    options.checkFormFields !== null
  ) {
    return options.checkFormFields;
  }
  for (const step of definition.steps) {
    if (!isJoinStep(step) && step.assignee.kind === "field") {
      const fields = options.forms?.get(step.assignee.formKey);
      if (fields !== undefined && fields !== null) {
        return fields;
      }
    }
  }
  return null;
}
