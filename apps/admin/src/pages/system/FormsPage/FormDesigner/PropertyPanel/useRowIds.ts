import { useState } from "react";

export interface RowIds {
  /** 每一列的穩定 id(與列一一對應,當 React key 用) */
  ids: number[];
  /** 在最後加一列時呼叫(在改資料之前或之後都可以) */
  added: () => void;
  /** 刪掉第 `index` 列時呼叫 */
  removed: (index: number) => void;
}

/**
 * 可增刪的清單列的**穩定內部 id**(靜態選項的列、帶入對應…):React key 不能用列的內容
 * (改 value 時 key 跟著變 → 整列重掛 → 輸入框每打一字就失焦),也不宜用索引(刪中間一列時後面的列會錯位)。
 * 列數被外部改掉(換選項來源清空)時多出來的列補新 id、少的截掉。
 */
export const useRowIds = (count: number): RowIds => {
  const [state, setState] = useState(() => ({
    ids: Array.from({ length: count }, (_item, index) => index),
    next: count,
  }));
  const ids = Array.from(
    { length: count },
    (_item, index) => state.ids[index] ?? state.next + index,
  );
  return {
    ids,
    added: () => {
      const next = state.next + count;
      setState({ ids: [...ids, next], next: next + 1 });
    },
    removed: (index) => {
      setState({
        ids: ids.filter((_id, at) => at !== index),
        next: state.next + count,
      });
    },
  };
};
