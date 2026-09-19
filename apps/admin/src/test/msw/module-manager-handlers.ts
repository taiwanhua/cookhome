import { HttpResponse } from "msw";

import type {
  ModuleTreeQuery,
  SetModuleEnabledMutationVariables,
  SetPermissionEnabledMutationVariables,
} from "@repo/graphql";

import { type AuthErrorCode, graphqlError } from "./auth-handlers";
import { api } from "./server";

export type TestModuleAdminNode = ModuleTreeQuery["moduleTree"][number];
export type TestPermissionAdmin = TestModuleAdminNode["permissions"][number];

/** 會被指定失敗的操作(值是 `errors[0].extensions.code`)。 */
export type ModuleAdminOperation = "SetModuleEnabled" | "SetPermissionEnabled";

export interface ModuleAdminWorldOptions {
  tree?: TestModuleAdminNode[];
  failures?: Partial<Record<ModuleAdminOperation, string>>;
}

export interface ModuleAdminWorld {
  handlers: Parameters<typeof import("./server").server.use>;
  /** 各操作收到的輸入(依序),用來斷言「送出去的是什麼」 */
  inputs: {
    setModuleEnabled: SetModuleEnabledMutationVariables["input"][];
    setPermissionEnabled: SetPermissionEnabledMutationVariables["input"][];
  };
  /** `moduleTree` 被打到的次數(驗 invalidate 之後真的重新查了一次) */
  calls: { moduleTree: number };
}

/** 走訪用的寬鬆形狀:codegen 把遞迴展開成五層具名型別,最深一層沒有 `children`。 */
interface MutableNode {
  id: string;
  enabled: boolean;
  permissions: { id: string; enabled: boolean }[];
  children?: MutableNode[];
}

const flatten = (nodes: readonly MutableNode[]): MutableNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);

/**
 * 模組與權限頁的假 api(#204 的三個端點)。
 *
 * 樹是**有狀態的**:切換後的 `enabled` 寫回同一份資料,所以「mutation → invalidate →
 * 重新查 `moduleTree`」在測試裡看得到新的值 —— 只回一個固定樹的 handler 驗不出失效有沒有發生。
 * 停用連動整棵子樹、啟用只啟用自己,兩條規則照 `docs/modules/module-manager.md` 實作,
 * 前端才不會對著一個比 api 寬鬆的假伺服器寫測試。
 */
export const moduleAdminWorld = (
  options: ModuleAdminWorldOptions = {},
): ModuleAdminWorld => {
  const { tree = [], failures = {} } = options;

  const state = structuredClone(tree) as unknown as MutableNode[];
  const inputs: ModuleAdminWorld["inputs"] = {
    setModuleEnabled: [],
    setPermissionEnabled: [],
  };
  const calls = { moduleTree: 0 };

  const fail = (operation: ModuleAdminOperation) => {
    const code = failures[operation];
    return code === undefined
      ? null
      : graphqlError(code as AuthErrorCode, code);
  };

  const handlers = [
    api.query("ModuleTree", () => {
      calls.moduleTree += 1;
      return HttpResponse.json({ data: { moduleTree: state } });
    }),
    api.mutation("SetModuleEnabled", ({ variables }) => {
      const { input } = variables as SetModuleEnabledMutationVariables;
      inputs.setModuleEnabled.push(input);
      const failure = fail("SetModuleEnabled");
      if (failure !== null) {
        return failure;
      }
      const target = flatten(state).find((node) => node.id === input.id);
      if (target === undefined) {
        return graphqlError("FORBIDDEN", "NOT_FOUND");
      }
      // 停用連動整棵子樹;啟用只啟用自己這一節
      const affected = input.enabled ? [target] : flatten([target]);
      for (const node of affected) {
        node.enabled = input.enabled;
      }
      return HttpResponse.json({
        data: { setModuleEnabled: { module: target } },
      });
    }),
    api.mutation("SetPermissionEnabled", ({ variables }) => {
      const { input } = variables as SetPermissionEnabledMutationVariables;
      inputs.setPermissionEnabled.push(input);
      const failure = fail("SetPermissionEnabled");
      if (failure !== null) {
        return failure;
      }
      const target = flatten(state)
        .flatMap((node) => node.permissions)
        .find((item) => item.id === input.id);
      if (target === undefined) {
        return graphqlError("FORBIDDEN", "NOT_FOUND");
      }
      target.enabled = input.enabled;
      return HttpResponse.json({
        data: { setPermissionEnabled: { permission: target } },
      });
    }),
  ];

  return {
    handlers: handlers as ModuleAdminWorld["handlers"],
    inputs,
    calls,
  };
};
