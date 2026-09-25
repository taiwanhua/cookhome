import { HttpResponse } from "msw";

import type {
  OrgManagerCandidatesQueryVariables,
  OrgManagersQueryVariables,
  SetOrgManagersMutationVariables,
  UserSummaryFieldsFragment,
} from "@repo/graphql";

import { api } from "./server";

export type TestUserSummary = UserSummaryFieldsFragment;

export interface OrgManagersWorldOptions {
  /** orgId → 主管(設定順序);`setOrgManagers` 整組取代這份狀態 */
  managers: Record<string, TestUserSummary[]>;
  /** 本租戶啟用中的使用者;`orgManagerCandidates` 依關鍵字過濾它 */
  managerCandidates: TestUserSummary[];
  /** `SetOrgManagers` 被指定失敗時回的錯誤回應;null = 成功 */
  failure: () => Response | null;
}

/**
 * 組織主管(6b `org_manager`)的假 api:讀、候選、整組取代。由 `orgWorld` 組進組織管理頁的 handler,
 * 拆成獨立檔只是為了檔案長度 —— 名單是有連動語意的狀態(送出後 `OrgManagers` 讀到新名單,TEST-08)。
 */
export const orgManagersWorld = ({
  managers,
  managerCandidates,
  failure,
}: OrgManagersWorldOptions) => {
  const managersByOrg = new Map(
    Object.entries(managers).map(([orgId, rows]) => [orgId, [...rows]]),
  );
  const inputs: SetOrgManagersMutationVariables["input"][] = [];

  const handlers = [
    api.query("OrgManagers", ({ variables }) => {
      const { id } = variables as OrgManagersQueryVariables;
      return HttpResponse.json({
        data: { org: { id, managers: managersByOrg.get(id) ?? [] } },
      });
    }),
    api.query("OrgManagerCandidates", ({ variables }) => {
      const { keyword } = variables as OrgManagerCandidatesQueryVariables;
      const needle = keyword?.trim().toLowerCase() ?? "";
      return HttpResponse.json({
        data: {
          orgManagerCandidates: managerCandidates.filter(
            (row) =>
              needle === "" ||
              row.name.toLowerCase().includes(needle) ||
              row.account.toLowerCase().includes(needle),
          ),
        },
      });
    }),
    api.mutation("SetOrgManagers", ({ variables }) => {
      const { input } = variables as SetOrgManagersMutationVariables;
      inputs.push(input);
      const failed = failure();
      if (failed !== null) {
        return failed;
      }
      const known = [
        ...managerCandidates,
        ...[...managersByOrg.values()].flat(),
      ];
      const next = input.userIds.flatMap((userId) => {
        const row = known.find((one) => one.id === userId);
        return row === undefined ? [] : [row];
      });
      managersByOrg.set(input.orgId, next);
      return HttpResponse.json({
        data: {
          setOrgManagers: { org: { id: input.orgId, managers: next } },
        },
      });
    }),
  ];

  return { handlers, inputs };
};
