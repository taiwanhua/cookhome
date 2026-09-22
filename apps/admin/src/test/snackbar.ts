import { waitFor, within } from "@testing-library/react";

/**
 * 操作結果提示(#376)的查詢 helper。
 *
 * **要用容器收斂,不能只 `findByText`**:失敗提示與頁面 / 彈窗上那一條錯誤是**同一份
 * 文案**(刻意的:同一份錯誤解讀),只比文字會同時抓到兩個節點,也證明不了提示真的跳了。
 * Snackbar 是 portal 出去的,`.MuiSnackbar-root` 是它唯一穩定的容器
 * (同 TEST-09「驗樣式直接讀 MUI / emotion 產出的東西」的取捨)。
 */
const snackbarRoot = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(".MuiSnackbar-root");

/** 等提示出現,回傳它的容器(在裡面再用 `within` 找 alert / 關閉鈕)。 */
export const findSnackbar = async (): Promise<HTMLElement> =>
  waitFor(() => {
    const root = snackbarRoot();
    if (root === null) {
      throw new Error("Snackbar 還沒出現");
    }
    return root;
  });

/**
 * 等提示出現並回傳那一則的文字與語氣(`success` / `error` 取自 MUI Alert 的 class)。
 *
 * `hidden: true` 是必要的:**彈窗開著時 MUI 的 modal manager 會把 body 底下其他節點
 * 標上 `aria-hidden`**,提示雖然看得到,但在無障礙樹上是隱藏的(見 PR #376 的規則回饋)。
 */
export const findSnackbarAlert = async (): Promise<{
  text: string;
  severity: "success" | "error";
}> => {
  const alert = within(await findSnackbar()).getByRole("alert", {
    hidden: true,
  });
  return {
    text: alert.textContent,
    severity: alert.classList.contains("MuiAlert-colorSuccess")
      ? "success"
      : "error",
  };
};

/** 這次操作不該跳提示(dry-run / 預覽那一類)。 */
export const querySnackbar = (): HTMLElement | null => snackbarRoot();
