import { WorkflowVersionStatus } from "@repo/graphql";

import { SHOPPING_FORM_KEY } from "@/test/msw/form-fixtures";
import type { WorkflowDesignWorldOptions } from "@/test/msw/workflow-design-handlers";
import {
  LEAVE_FORM_KEY,
  leaveWorkflowDefinition,
  purchaseWorkflowDefinition,
  workflowFragment,
  workflowVersionFragment,
} from "@/test/msw/workflow-fixtures";

/**
 * mock 開發模式的流程管理假資料:直線的「病假審核」(客製,綁了病假單)與平行的「採購審核」
 * (共用,已發布第 1 版 + 一份草稿;版本面板看得到「匯出專案設定」)。
 */
export const mockWorkflowDesign = (): WorkflowDesignWorldOptions => ({
  workflows: [
    workflowFragment({
      boundForms: [
        { formKey: LEAVE_FORM_KEY, formName: "病假單", moduleKey: "demo.form" },
      ],
    }),
    workflowFragment({
      key: "purchase_review",
      name: "採購審核",
      isShared: true,
      ownerOrgId: null,
      ownerOrgName: null,
      hasDraft: true,
    }),
  ],
  versions: {
    leave_review: [
      workflowVersionFragment(leaveWorkflowDefinition(), { baseVersion: 1 }),
      workflowVersionFragment(leaveWorkflowDefinition(), {
        id: "wv-leave-1",
        version: 1,
        status: WorkflowVersionStatus.Published,
        changelog: "第一版",
      }),
    ],
    purchase_review: [
      workflowVersionFragment(purchaseWorkflowDefinition(), {
        id: "wv-purchase-draft",
        workflowKey: "purchase_review",
        baseVersion: 1,
      }),
      workflowVersionFragment(purchaseWorkflowDefinition(), {
        id: "wv-purchase-1",
        workflowKey: "purchase_review",
        version: 1,
        status: WorkflowVersionStatus.Published,
        changelog: "第一版",
      }),
    ],
  },
  bindingOptions: {
    [SHOPPING_FORM_KEY]: [
      {
        workflowKey: "leave_review",
        workflowName: "病假審核",
        isShared: false,
        canBind: true,
        issues: [],
      },
      {
        workflowKey: "purchase_review",
        workflowName: "採購審核",
        isShared: true,
        canBind: false,
        issues: [
          {
            stepKey: "finance",
            stepNumber: 2,
            problem: "ROLE_IN_SHARED",
            detail: "角色佔位",
          },
        ],
      },
    ],
  },
});
