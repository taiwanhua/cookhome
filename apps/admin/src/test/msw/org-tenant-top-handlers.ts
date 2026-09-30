import { HttpResponse } from "msw";

import type {
  OrgQuery,
  SetOrgTimezoneMutationVariables,
  SetOrgVisibilityMutationVariables,
} from "@repo/graphql";

import { api } from "./server";

type TestOrg = OrgQuery["org"];

export interface OrgTenantTopWorldOptions {
  /** 指定失敗時回的錯誤回應;null = 成功 */
  failure: (
    operation: "SetOrgVisibility" | "SetOrgTimezone",
  ) => Response | null;
}

/**
 * 租戶頂層專屬設定的假 api:可見範圍開關(`setOrgVisibility`)與租戶時區(`setOrgTimezone`)。
 * 由 `orgWorld` 組進組織管理頁的 handler,拆成獨立檔只是為了檔案長度。
 * 時區是有連動語意的狀態:儲存後重查 `org(id)` 要讀到新值(TEST-08),
 * 所以 `org(id)` 的回應經 `withTimezone` 疊上這裡記下的值。
 */
export const orgTenantTopWorld = ({ failure }: OrgTenantTopWorldOptions) => {
  const timezoneByOrg = new Map<string, string | null>();
  const inputs = {
    setOrgVisibility: [] as SetOrgVisibilityMutationVariables["input"][],
    setOrgTimezone: [] as SetOrgTimezoneMutationVariables["input"][],
  };

  const withTimezone = (org: TestOrg): TestOrg =>
    timezoneByOrg.has(org.id)
      ? { ...org, timezone: timezoneByOrg.get(org.id) ?? null }
      : org;

  const handlers = [
    api.mutation("SetOrgVisibility", ({ variables }) => {
      const { input } = variables as SetOrgVisibilityMutationVariables;
      inputs.setOrgVisibility.push(input);
      return (
        failure("SetOrgVisibility") ??
        HttpResponse.json({
          data: {
            setOrgVisibility: {
              org: { id: input.orgId, visibility: input.visibility },
            },
          },
        })
      );
    }),
    api.mutation("SetOrgTimezone", ({ variables }) => {
      const { input } = variables as SetOrgTimezoneMutationVariables;
      inputs.setOrgTimezone.push(input);
      const failed = failure("SetOrgTimezone");
      if (failed !== null) {
        return failed;
      }
      const timezone = input.timezone ?? null;
      timezoneByOrg.set(input.orgId, timezone);
      return HttpResponse.json({
        data: { setOrgTimezone: { org: { id: input.orgId, timezone } } },
      });
    }),
  ];

  return { handlers, inputs, withTimezone };
};
