import { jest } from "@jest/globals";

import type { AuthTestApp } from "../../auth/test-support/auth-app";
import { WorkflowEngineHooks } from "../workflow-engine/workflow-engine.service";

/**
 * 引擎檢查點的測試接縫(TEST-07 的第二個接縫,理由見 `WorkflowEngineHooks`):
 * 讓某個檢查點在第 `nth` 次走到時丟錯(模擬中斷),或插進一段動作(控制交錯)。回復原狀的函式。
 */
export function interruptAt(
  api: AuthTestApp,
  checkpoint: string,
  nth = 1,
): () => void {
  const hooks = api.app.get(WorkflowEngineHooks);
  let seen = 0;
  const spy = jest
    .spyOn(hooks, "reached")
    .mockImplementation((reached: string) => {
      if (reached === checkpoint) {
        seen += 1;
        if (seen === nth) {
          return Promise.reject(new Error(`模擬中斷:${checkpoint}`));
        }
      }
      return Promise.resolve();
    });
  return () => {
    spy.mockRestore();
  };
}

/** 走到某個檢查點(第一次)時先做 `action`,再繼續原本的流程。 */
export function interleaveAt(
  api: AuthTestApp,
  checkpoint: string,
  action: () => Promise<unknown>,
): () => void {
  const hooks = api.app.get(WorkflowEngineHooks);
  let isDone = false;
  const spy = jest
    .spyOn(hooks, "reached")
    .mockImplementation(async (reached: string) => {
      if (reached === checkpoint && !isDone) {
        isDone = true;
        await action();
      }
    });
  return () => {
    spy.mockRestore();
  };
}
