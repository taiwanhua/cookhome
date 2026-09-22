import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import { Snackbar } from "@repo/ui/snackbar";

import { useSnackbarStore } from "@/stores/useSnackbarStore";

export interface SnackbarProviderProps {
  children: ReactNode;
}

/**
 * 全站唯一的操作結果提示出口(掛在 `AppProviders`,所以每一頁、每個彈窗都共用同一則)。
 *
 * 狀態本體在 `stores/useSnackbarStore`(REACT-02:provider 只做注入與渲染),
 * 送出提示一律經 `hooks/useMutationFeedback.ts`。排隊策略(長度 1、只顯示最新一則)
 * 的理由寫在 store 與 `@repo/ui/snackbar` 的 JSDoc。
 *
 * `key` 綁在那一則的 `id` 上:同語氣的連續兩則(接連儲存兩次)要重跑一次進場動畫與
 * 自動關閉計時,否則第二則會沿用第一則剩下的秒數、看起來像「沒有反應」。
 */
export const SnackbarProvider = ({ children }: SnackbarProviderProps) => {
  const t = useTranslations("admin.app.snackbar");
  const current = useSnackbarStore((state) => state.current);
  const dismiss = useSnackbarStore((state) => state.dismiss);

  return (
    <>
      {children}
      {current !== null && (
        <Snackbar
          key={current.id}
          open
          severity={current.severity}
          message={current.message}
          closeLabel={t("close")}
          onClose={dismiss}
        />
      )}
    </>
  );
};
