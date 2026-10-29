import type { ListPageShellDecisions } from "../height-chain";

/**
 * 專案的列表頁 / 列表分頁(`app/PageRootHeight.test.tsx` 的對照清單;底座的寫在該測試裡,不必動)。
 * 這份清單就是決定本身:新列表頁要用列表頁殼(`LIST_PAGE_SHELL_SX`,STYLE-08)就加進來;
 * 看板、表單、設定這類內容頁與內容分頁不在這裡(整頁捲)。底座版為空。
 */
export const projectListPageShells: ListPageShellDecisions = {
  // 分頁全是列表的頁(頁殼直接用 `LIST_PAGE_SHELL_SX`)
  pages: [],
  // 分頁混著列表與內容的頁,標成列表分頁(`isList`)的那幾頁:`<路徑>#<分頁名>`
  tabs: [],
};
