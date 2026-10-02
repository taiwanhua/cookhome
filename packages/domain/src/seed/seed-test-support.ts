import { definitionOf, field } from "../form/form-test-support";
import type { FieldDef, FormDefinition } from "../form/types";
import type { WorkflowDefinition } from "../workflow/types";
import { review } from "../workflow/workflow-test-support";
import type {
  FormDefinitionSeedSet,
  WorkflowDefinitionSeedSet,
} from "./declaration";
import type { PortableCatalog } from "./portable-definition";

/** 測試夾具:使用者型引用欄(`reference` + `user` 來源)。 */
export function userReference(
  key: string,
  overrides: Partial<FieldDef> = {},
): FieldDef {
  return field(key, "reference", {
    source: { provider: "user", labelField: "name" },
    ...overrides,
  });
}

/** 測試夾具:一份共用表單宣告(掛在 `demo-form` 模組、目標已發布)。 */
export function formSeed(
  fields: FieldDef[],
  overrides: Partial<FormDefinitionSeedSet> = {},
  definition?: Partial<FormDefinition>,
): FormDefinitionSeedSet {
  return {
    kind: "form-definition",
    key: "leave_request",
    revision: "r1",
    name: "請假單",
    changelog: "初版",
    desiredStatus: "published",
    moduleKey: "demo-form",
    tabLabelTemplate: null,
    definition: definitionOf(fields, definition),
    ...overrides,
  };
}

/** 測試夾具:一份共用流程宣告(預設一關主管審核)。 */
export function workflowSeed(
  definition?: WorkflowDefinition,
  overrides: Partial<WorkflowDefinitionSeedSet> = {},
): WorkflowDefinitionSeedSet {
  return {
    kind: "workflow-definition",
    key: "leave_flow",
    revision: "r1",
    name: "請假流程",
    changelog: "初版",
    desiredStatus: "published",
    checkFormKey: null,
    definition: definition ?? { steps: [review("boss")] },
    ...overrides,
  };
}

/** 測試夾具:同一計畫可解析的 key(一個表單模組、一個受管類別與它的兩個種子選項)。 */
export function catalogOf(
  overrides: Partial<PortableCatalog> = {},
): PortableCatalog {
  return {
    formModuleKeys: new Set(["demo-form"]),
    fieldCategories: new Map([["gender", new Set(["male", "female"])]]),
    sharedForms: new Map(),
    ...overrides,
  };
}
