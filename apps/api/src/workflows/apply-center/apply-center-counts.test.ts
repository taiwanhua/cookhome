import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";

import {
  type AuthTestApp,
  startAuthTestApp,
} from "../../auth/test-support/auth-app";
import { createOrg } from "../../auth/test-support/fixtures";
import { call, createDraft, ok } from "../../forms/test-support/form-fixtures";
import {
  FORM_KEY,
  MY_APPLICATIONS,
  MY_TASKS,
  type Person,
  WORKFLOW_MODULE,
  WORKFLOW_TEST_TIMEOUT_MS,
  type World,
  decideOn,
  errorCode,
  person,
  setupWorld,
  submitLeave,
  useWorkflow,
  usersStep,
} from "../test-support/workflow-fixtures";

jest.setTimeout(WORKFLOW_TEST_TIMEOUT_MS);

const APPLY_CENTER_COUNTS = /* GraphQL */ `
  query ApplyCenterCounts {
    applyCenterCounts {
      myTasks
      myApplications
    }
  }
`;

interface Counts {
  myTasks: number;
  myApplications: number;
}

describe("申請中心計數(applyCenterCounts)", () => {
  let api: AuthTestApp;
  let world: World;
  let reviewer: Person;

  function staff(index: number): Person {
    const found = world.staff[index];
    if (!found) {
      throw new Error(`staff[${String(index)}] 不存在`);
    }
    return found;
  }

  async function countsOf(who: Person): Promise<Counts> {
    const data = await ok<{ applyCenterCounts: Counts }>(
      api,
      who.token,
      APPLY_CENTER_COUNTS,
    );
    return data.applyCenterCounts;
  }

  async function applicationsTotal(
    who: Person,
    status: string,
  ): Promise<number> {
    const data = await ok<{ myApplications: { totalCount: number } }>(
      api,
      who.token,
      MY_APPLICATIONS,
      { input: { status } },
    );
    return data.myApplications.totalCount;
  }

  async function pendingTasksTotal(who: Person): Promise<number> {
    const data = await ok<{ myTasks: { totalCount: number } }>(
      api,
      who.token,
      MY_TASKS,
      { input: { done: false } },
    );
    return data.myTasks.totalCount;
  }

  beforeAll(async () => {
    api = await startAuthTestApp("workflow_apply_center_counts", {
      WORKFLOW_MAIL_ENABLED: "false",
    });
    world = await setupWorld(api, api.connection, 2);
    reviewer = staff(0);
    await useWorkflow(world, "counts_flow", {
      steps: [usersStep("one", [reviewer])],
    });
  });

  afterAll(async () => {
    await api.close();
  });

  it("兩數與列表預設篩選一致:審核中與被退回算進行中,已完成 / 已駁回 / 草稿不算;待處理任務數隨審核減少", async () => {
    await expect(countsOf(world.applicant)).resolves.toEqual({
      myTasks: 0,
      myApplications: 0,
    });
    const reviewing = await submitLeave(world);
    const returned = await submitLeave(world);
    const approved = await submitLeave(world);
    const rejected = await submitLeave(world);
    await createDraft(api, world.applicant.token, FORM_KEY, {
      title: "草稿",
      days: 1,
    });
    await expect(countsOf(reviewer)).resolves.toMatchObject({ myTasks: 4 });
    await decideOn(world, reviewer, returned.id, "RETURN");
    await decideOn(world, reviewer, approved.id, "APPROVE");
    await decideOn(world, reviewer, rejected.id, "REJECT");

    const applicantCounts = await countsOf(world.applicant);
    expect(applicantCounts).toEqual({ myTasks: 0, myApplications: 2 });
    const listed =
      (await applicationsTotal(world.applicant, "REVIEWING")) +
      (await applicationsTotal(world.applicant, "RETURNED"));
    expect(listed).toBe(applicantCounts.myApplications);

    const reviewerCounts = await countsOf(reviewer);
    expect(reviewerCounts).toEqual({ myTasks: 1, myApplications: 0 });
    await expect(pendingTasksTotal(reviewer)).resolves.toBe(
      reviewerCounts.myTasks,
    );

    await decideOn(world, reviewer, reviewing.id, "APPROVE");
    await expect(countsOf(reviewer)).resolves.toMatchObject({ myTasks: 0 });
    await expect(countsOf(world.applicant)).resolves.toMatchObject({
      myApplications: 1,
    });
  });

  it("他人的不算:別人送的申請、派給別人的任務、別的租戶的人都是 0", async () => {
    const other = staff(1);
    const before = await countsOf(world.applicant);
    await submitLeave(world, null, other);
    await expect(countsOf(other)).resolves.toEqual({
      myTasks: 0,
      myApplications: 1,
    });
    await expect(countsOf(world.applicant)).resolves.toEqual(before);
    const otherTenant = await createOrg(world.connection, { name: "別租戶" });
    const stranger = await person(
      api,
      world.connection,
      otherTenant,
      otherTenant,
    );
    await expect(countsOf(stranger)).resolves.toEqual({
      myTasks: 0,
      myApplications: 0,
    });
  });

  it("權限同兩個列表:沒有申請中心 view 的人被拒", async () => {
    const outsider = await person(
      api,
      world.connection,
      world.tenant,
      world.tenant,
      {
        moduleKeys: [WORKFLOW_MODULE],
        permissionKeys: [`${WORKFLOW_MODULE}.*`],
      },
    );
    const denied = await call(api, outsider.token, APPLY_CENTER_COUNTS);
    expect(errorCode(denied)).toBe("FORBIDDEN");
  });
});
