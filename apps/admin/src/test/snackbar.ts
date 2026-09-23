import { screen, waitFor, within } from "@testing-library/react";

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
 * 螢幕閱讀器念得到的那一份文案(#430):沒有彈窗時是 Snackbar 自己的 `role="alert"`;
 * **彈窗開著時** app 根節點被 MUI 的 modal manager 標了 `aria-hidden`,alert 在無障礙樹上
 * 不存在,改由 `SnackbarProvider` 補的 `role="status"` 區域念。兩個查詢都**不帶 `hidden: true`**
 * —— 這個 helper 本身就是「提示念得到」的斷言,念不到就逾時失敗。
 */
const announcedTextOf = async (root: HTMLElement): Promise<string> => {
  const alert = within(root).queryByRole("alert");
  if (alert !== null) {
    return alert.textContent;
  }
  return waitFor(() => {
    const text = screen.getByRole("status").textContent;
    if (text === "") {
      throw new Error("status 區域還沒填字");
    }
    return text;
  });
};

/**
 * 等提示出現並回傳那一則的文字與語氣(`success` / `error` 取自 MUI Alert 的 class)。
 * 文字取的是**螢幕閱讀器念得到的那一份**(`announcedTextOf`),彈窗開著時也一樣。
 */
export const findSnackbarAlert = async (): Promise<{
  text: string;
  severity: "success" | "error";
}> => {
  const root = await findSnackbar();
  const alert = root.querySelector(".MuiAlert-root");
  return {
    text: await announcedTextOf(root),
    severity:
      alert?.classList.contains("MuiAlert-colorSuccess") === true
        ? "success"
        : "error",
  };
};

/** 這次操作不該跳提示(dry-run / 預覽那一類)。 */
export const querySnackbar = (): HTMLElement | null => snackbarRoot();
