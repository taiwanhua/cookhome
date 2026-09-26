import { useMemo, useState } from "react";

import type { WorkflowDefinition } from "@repo/domain/workflow";

import { definitionInputOf } from "@/lib/workflow/definition";
import {
  type Flow,
  type FlowOpError,
  parseFlow,
  toDefinition,
} from "@/lib/workflow/flow-model";
import type { FlowOpResult } from "@/lib/workflow/flow-ops";

const fingerprintOf = (definition: WorkflowDefinition): string =>
  JSON.stringify(definitionInputOf(definition));

/**
 * 設計器的編輯狀態:段落串(`flow-model.ts`)、選中的節點、上一個被拒絕的操作,與「有沒有未存的變更」
 * (與上次存檔的定義比對,不是比有沒有按過東西)。
 *
 * 草稿的結構表示不了(`parseFlow` 回 null:手改過的 JSON、舊資料)時 `flow` 為 null,
 * 設計器改成唯讀顯示原定義與檢查結果,不去猜使用者要的是什麼。
 */
export const useFlowDesignerState = (initial: WorkflowDefinition) => {
  const [flow, setFlow] = useState<Flow | null>(() => parseFlow(initial));
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    fingerprintOf(initial),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [opError, setOpError] = useState<FlowOpError | null>(null);
  const definition = useMemo(
    () => (flow === null ? initial : toDefinition(flow)),
    [flow, initial],
  );
  const isDirty =
    flow !== null && fingerprintOf(definition) !== savedFingerprint;

  return {
    flow,
    definition,
    isDirty,
    selectedKey,
    opError,
    select: (key: string | null) => {
      setSelectedKey(key);
      setOpError(null);
    },
    /** 套用一個操作的結果;被拒就記下原因(畫面顯示),段落串不變 */
    apply: (result: FlowOpResult) => {
      if (!result.ok) {
        setOpError(result.error);
        return;
      }
      setFlow(result.flow);
      setOpError(null);
      if (result.selectedKey !== undefined) {
        setSelectedKey(result.selectedKey);
      }
    },
    /** 直接改段落串(改一關的內容、改匯合名稱這類不會違反形狀的) */
    update: (next: Flow) => {
      setFlow(next);
    },
    markSaved: (saved: WorkflowDefinition) => {
      setSavedFingerprint(fingerprintOf(saved));
    },
  };
};

export type FlowDesignerState = ReturnType<typeof useFlowDesignerState>;
