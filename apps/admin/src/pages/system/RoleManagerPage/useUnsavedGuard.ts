import { useEffect } from "react";

/**
 * 有未儲存的變更時,關分頁 / 重新整理先由瀏覽器問一次(頁內的切頁籤與換角色由
 * `DiscardChangesDialog` 攔)。`beforeunload` 只能由瀏覽器出面,頁面攔不到那一層。
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
