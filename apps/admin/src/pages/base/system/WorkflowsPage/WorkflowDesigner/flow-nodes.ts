import type { Node } from "@xyflow/react";

/**
 * 流程圖節點的資料(React Flow 的 `node.data`)。節點元件只負責畫,文案在設計器組好再交給它
 * (節點元件是模組層常數、不拿 `t`,REACT-09 同理:槽位元件不靠閉包)。
 */
export interface ReviewNodeData extends Record<string, unknown> {
  title: string;
  /** 來源 / 會簽 / 跳過條件 / 可否退回,一行一件事 */
  lines: string[];
  /** 這一關的檢查器錯誤數(0 = 不標) */
  issueCount: number;
  issueLabel: string;
}

export interface JoinNodeData extends Record<string, unknown> {
  title: string;
  issueCount: number;
  issueLabel: string;
}

export type ReviewFlowNode = Node<ReviewNodeData, "review">;
export type JoinFlowNode = Node<JoinNodeData, "join">;
export type WorkflowFlowNode = ReviewFlowNode | JoinFlowNode;
