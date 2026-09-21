import { useEffect } from "react";

/**
 * 有未儲存的變更時,關分頁 / 重新整理先由瀏覽器問一次(頁內的取消與導向由
 * `DiscardChangesDialog` 攔)。`beforeunload` 只能由瀏覽器出面,頁面攔不到那一層。
 *
 * 與角色管理頁的 `useUnsavedGuard` 是同一份東西(PR 有記:依 STRUCT-03 應上提到 `components/` 或
 * `hooks/` 收斂成一份,本票不動角色頁)。
 */
export const useUnsavedGuard = (isDirty: boolean): void => {
  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    globalThis.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      globalThis.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isDirty]);
};
