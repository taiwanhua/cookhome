import { describe, expect, it } from "@jest/globals";

import { CTX, field } from "../form/form-test-support";
import { initialStepStates } from "./advance";
import { evaluateStep, historyIndexOf, selectOutcome } from "./evaluate";
import {
  endStepKey,
  nextStepKeys,
  previousStepKeys,
  startStepKey,
} from "./graph";
import { orgChainToTenant, resolveManagersFrom } from "./managers";
import { buildPlan, nextTaskKey, shouldSkipStep } from "./plan";
import { projectTask } from "./projection";
import type { StepState, WorkflowDefinition } from "./types";
import {
  LINEAR,
  NOW,
  PURCHASE,
  decide,
  entered,
  newInstance,
  review,
} from "./workflow-test-support";

describe("@repo/domain/workflow 圖形查詢", () => {
  it("nextStepKeys:沒有 edges 照陣列順序、最後一關回空;有 edges 回所有出線目標", () => {
    expect(nextStepKeys(LINEAR, "boss")).toEqual(["hr"]);
    expect(nextStepKeys(LINEAR, "hr")).toEqual([]);
    expect(nextStepKeys(PURCHASE, "init")).toEqual([
      "finance",
      "legal",
      "purchase",
    ]);
    expect(nextStepKeys(PURCHASE, "merge")).toEqual(["confirm"]);
    expect(nextStepKeys(PURCHASE, "confirm")).toEqual([]);
  });

  it("previousStepKeys:匯合節點回所有入線來源", () => {
    expect(previousStepKeys(PURCHASE, "merge")).toEqual([
      "finance",
      "legal",
      "purchase",
    ]);
    expect(previousStepKeys(LINEAR, "hr")).toEqual(["boss"]);
    expect(previousStepKeys(LINEAR, "boss")).toEqual([]);
  });

  it("startStepKey:沒有 edges 是 steps[0];有 edges 是唯一無入線節點,陣列順序打亂也一樣", () => {
    expect(startStepKey(LINEAR)).toBe("boss");
    const shuffled: WorkflowDefinition = {
      steps: PURCHASE.steps.toReversed(),
      edges: PURCHASE.edges ?? null,
    };
    expect(shuffled.steps[0]?.key).toBe("confirm");
    expect(startStepKey(shuffled)).toBe("init");
    expect(endStepKey(shuffled)).toBe("confirm");
    expect(endStepKey(LINEAR)).toBe("hr");
  });

  it("空陣列的 edges 視同直線", () => {
    expect(startStepKey({ steps: LINEAR.steps, edges: [] })).toBe("boss");
    expect(nextStepKeys({ steps: LINEAR.steps, edges: [] }, "boss")).toEqual([
      "hr",
    ]);
  });
});

const plan = (keys: string[]): StepState["plan"] =>
  keys.map((taskKey, index) => ({
    taskKey,
    assigneeId: `u${String(index)}`,
    previousAssigneeIds: [],
    assigneeState: "active",
  }));

describe("@repo/domain/workflow evaluateStep 與全案終局", () => {
  it("any:第一筆就是結果,之後都 late", () => {
    let instance = entered(newInstance(LINEAR), "boss", ["a", "b"]);
    instance = decide(instance, "boss", "boss-2", "rejected", "否");
    instance = decide(instance, "boss", "boss-1", "approved");
    const state = instance.steps[0];
    if (!state) {
      throw new Error("no state");
    }
    const evaluation = evaluateStep("any", state, instance.history);
    expect(evaluation.result).toEqual({
      kind: "rejected",
      taskKey: "boss-2",
      historyIndex: 1,
    });
    expect([...evaluation.lateTaskKeys]).toEqual(["boss-1"]);
  });

  it("all:第一筆駁回 / 退回是結果、它之前的核准仍算數、之後都 late;全員核准才完成", () => {
    const history = [
      { at: NOW, kind: "approved" as const, taskKey: "s-1" },
      { at: NOW, kind: "returned" as const, taskKey: "s-2" },
      { at: NOW, kind: "rejected" as const, taskKey: "s-3" },
    ];
    const decisions = history.map((event) => ({
      taskKey: event.taskKey,
      userId: event.taskKey,
      decision: event.kind,
      comment: null,
      at: NOW,
    }));
    const evaluation = evaluateStep(
      "all",
      { plan: plan(["s-1", "s-2", "s-3"]), decisions },
      history,
    );
    expect(evaluation.result).toEqual({
      kind: "returned",
      taskKey: "s-2",
      historyIndex: 1,
    });
    expect([...evaluation.effectiveTaskKeys]).toEqual(["s-1", "s-2"]);
    expect([...evaluation.lateTaskKeys]).toEqual(["s-3"]);

    const partial = evaluateStep(
      "all",
      { plan: plan(["s-1", "s-2"]), decisions: decisions.slice(0, 1) },
      history,
    );
    expect(partial.result).toEqual({ kind: "none" });
    const approvedAll = evaluateStep(
      "all",
      {
        plan: plan(["s-1"]),
        decisions: decisions.slice(0, 1),
      },
      history,
    );
    expect(approvedAll.result).toEqual({ kind: "completed" });
  });

  it("historyIndexOf:找不到對應事件回 null(不是 Infinity)", () => {
    expect(
      historyIndexOf([], { taskKey: "s-1", decision: "rejected" }),
    ).toBeNull();
  });

  it("all:空計畫永遠不算完成", () => {
    expect(evaluateStep("all", { plan: [], decisions: [] }, []).result).toEqual(
      { kind: "none" },
    );
  });

  it("全案終局:取接受順序(historyIndex)最早的一筆", () => {
    expect(
      selectOutcome([
        {
          kind: "rejected",
          stepKey: "finance",
          taskKey: "f-1",
          historyIndex: 9,
        },
        { kind: "returned", stepKey: "legal", taskKey: "l-1", historyIndex: 4 },
      ]),
    ).toEqual({
      kind: "returned",
      stepKey: "legal",
      taskKey: "l-1",
      historyIndex: 4,
    });
    expect(selectOutcome([])).toBeNull();
  });
});

describe("@repo/domain/workflow 任務投影規則", () => {
  it("五條規則由上往下第一個成立", () => {
    let instance = entered(newInstance(LINEAR), "boss", ["a", "b", "c", "d"]);
    instance = decide(instance, "boss", "boss-1", "approved");
    instance = decide(instance, "boss", "boss-2", "rejected", "晚到");
    const state = instance.steps[0];
    if (!state) {
      throw new Error("no state");
    }
    const invalid = {
      ...state,
      plan: state.plan.map((item) =>
        item.taskKey === "boss-4"
          ? { ...item, assigneeState: "invalid" as const }
          : item,
      ),
    };
    const evaluation = evaluateStep("any", invalid, instance.history);
    const statusOf = (taskKey: string, step: StepState = invalid): string => {
      const item = step.plan.find((candidate) => candidate.taskKey === taskKey);
      if (!item) {
        throw new Error("no item");
      }
      return projectTask(instance, step, evaluation, item).status;
    };
    expect(statusOf("boss-1")).toBe("approved");
    expect(statusOf("boss-2")).toBe("late");
    expect(statusOf("boss-3")).toBe("pending");
    expect(statusOf("boss-4")).toBe("blocked");
    const closed = { ...invalid, status: "completed" as const };
    expect(statusOf("boss-3", closed)).toBe("cancelled");
    expect(statusOf("boss-4", closed)).toBe("cancelled");
  });

  it("被 outcome 排除的其他分支駁回 → late;outcome 那筆 → 原決定", () => {
    let instance = entered(newInstance(PURCHASE), "finance", ["f"]);
    instance = entered(instance, "legal", ["l"]);
    instance = decide(instance, "legal", "legal-1", "returned", "補件");
    instance = decide(instance, "finance", "finance-1", "rejected", "否");
    instance = {
      ...instance,
      status: "returned",
      outcome: {
        kind: "returned",
        stepKey: "legal",
        taskKey: "legal-1",
        historyIndex: 1,
      },
    };
    for (const [stepKey, expected] of [
      ["finance", "late"],
      ["legal", "returned"],
    ] as const) {
      const state = instance.steps.find((step) => step.stepKey === stepKey);
      const item = state?.plan[0];
      if (!state || !item) {
        throw new Error("no state");
      }
      const mode = stepKey === "legal" ? "all" : "any";
      const evaluation = evaluateStep(mode, state, instance.history);
      expect(projectTask(instance, state, evaluation, item)).toMatchObject({
        status: expected,
        decidedAt: NOW,
      });
    }
  });
});

describe("@repo/domain/workflow 建立實例", () => {
  it("initialStepStates:版本的每個節點(含匯合)各一筆 pending", () => {
    expect(initialStepStates(PURCHASE)).toEqual(
      PURCHASE.steps.map((step) => ({
        stepKey: step.key,
        status: "pending",
        blocked: false,
        plan: [],
        decisions: [],
      })),
    );
  });
});

describe("@repo/domain/workflow 派任計畫與跳過條件", () => {
  it("buildPlan:去重、剔除申請人(自審)、taskKey 依序", () => {
    expect(
      buildPlan("hr", ["a", "me", "b", "a"], "me").map((item) => [
        item.taskKey,
        item.assigneeId,
      ]),
    ).toEqual([
      ["hr-1", "a"],
      ["hr-2", "b"],
    ]);
    expect(buildPlan("hr", ["me"], "me")).toEqual([]);
  });

  it("nextTaskKey:接在最大序號之後,不重用", () => {
    expect(nextTaskKey("hr", [{ taskKey: "hr-1" }, { taskKey: "hr-3" }])).toBe(
      "hr-4",
    );
    expect(nextTaskKey("hr", [])).toBe("hr-1");
  });

  it("shouldSkipStep:拿送出的表單內容算一次;沒設永遠不跳過", () => {
    const fields = [field("days", "number")];
    const step = review("hr", { skipWhen: { "<=": [{ var: "days" }, 1] } });
    expect(
      shouldSkipStep(step, { fields, values: { days: "1" }, ctx: CTX }),
    ).toBe(true);
    expect(
      shouldSkipStep(step, { fields, values: { days: "3" }, ctx: CTX }),
    ).toBe(false);
    expect(
      shouldSkipStep(review("hr"), { fields, values: { days: "0" }, ctx: CTX }),
    ).toBe(false);
  });
});

describe("@repo/domain/workflow 主管解析", () => {
  // 租戶 A:A(頂層)→ 台北店 → 廚房部
  const chain = orgChainToTenant("kitchen", ["root", "a", "taipei"], "a");

  it("orgChainToTenant:從提交組織往上到租戶頂層(上界),不往根組織走", () => {
    expect(chain).toEqual(["kitchen", "taipei", "a"]);
    expect(orgChainToTenant("a", ["root"], "a")).toEqual(["a"]);
    expect(orgChainToTenant("x", ["root", "b"], "a")).toEqual([]);
  });

  it("從提交所屬組織往上找第一組主管;level 2 再往上一組", () => {
    const managersByOrg = new Map([
      ["taipei", ["wang"]],
      ["a", ["boss"]],
    ]);
    expect(
      resolveManagersFrom({
        orgChain: chain,
        managersByOrg,
        applicantId: "ming",
        level: 1,
      }),
    ).toEqual(["wang"]);
    expect(
      resolveManagersFrom({
        orgChain: chain,
        managersByOrg,
        applicantId: "ming",
        level: 2,
      }),
    ).toEqual(["boss"]);
    expect(
      resolveManagersFrom({
        orgChain: chain,
        managersByOrg,
        applicantId: "ming",
        level: 3,
      }),
    ).toEqual([]);
  });

  it("申請人自己是主管 → 剔除;剔除後為空視同該層沒有主管,繼續往上;到頂還空 → 空", () => {
    expect(
      resolveManagersFrom({
        orgChain: chain,
        managersByOrg: new Map([
          ["kitchen", ["ming"]],
          ["taipei", ["ming", "vice"]],
        ]),
        applicantId: "ming",
        level: 1,
      }),
    ).toEqual(["vice"]);
    expect(
      resolveManagersFrom({
        orgChain: chain,
        managersByOrg: new Map([
          ["taipei", ["wang"]],
          ["a", ["wang"]],
        ]),
        applicantId: "wang",
        level: 1,
      }),
    ).toEqual([]);
  });

  it("level 不是正整數 → 空", () => {
    expect(
      resolveManagersFrom({
        orgChain: chain,
        managersByOrg: new Map([["taipei", ["wang"]]]),
        applicantId: "ming",
        level: 0,
      }),
    ).toEqual([]);
  });
});
