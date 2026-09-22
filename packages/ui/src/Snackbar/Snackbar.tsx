"use client";

import MuiAlert from "@mui/material/Alert";
import MuiSnackbar from "@mui/material/Snackbar";
import type { ReactNode, SyntheticEvent } from "react";

/** 提示的語氣。成功與失敗兩種就夠用(mutation 只有這兩種結果)。 */
export type SnackbarSeverity = "success" | "error";

export interface SnackbarProps {
  /** 顯示與否;關閉即由呼叫端把這一則從佇列上移除 */
  open: boolean;
  /** 提示內容(語言無關 — 文字由呼叫端給,I18N-01) */
  message: ReactNode;
  /** 語氣;預設成功 */
  severity?: SnackbarSeverity;
  /** 自動關閉的毫秒數;預設 4000,給 `null` 則不自動關 */
  autoHideDuration?: number | null;
  /** 關閉鈕的無障礙名稱(語言無關,由呼叫端給) */
  closeLabel: string;
  /** 自動逾時、按關閉鈕都會呼叫 */
  onClose: () => void;
}

/**
 * 操作結果提示(MUI Snackbar + Alert)。成功 / 失敗各一種語氣,4 秒自動關閉、
 * 也可以按右邊的 × 手動關;位置固定在右下角。顏色取自 theme 的 `success` / `error`
 * 語意色,不自帶品牌色。
 *
 * **排隊策略:一次只顯示最新的一則(latest-only),不排隊。** 本元件只負責畫「一則」,
 * 佇列在呼叫端 —— CookHome 的 app 層(`apps/admin` 的 `SnackbarProvider`)保管一個
 * 長度為 1 的佇列:新的一則進來就直接取代舊的那一則(舊的不補顯示)。
 * 理由是這些提示是**操作回饋**而非通知中心:連續送出三次時,使用者要看的是最後那一次
 * 的結果;排隊會讓第三則在 12 秒後才出現,那時早就換頁了。失敗的細節本來就另外
 * 留在表單 / 彈窗裡的欄位級錯誤上,不靠這裡補完。
 *
 * MUI 的 `onClose` 會帶 `reason`,點畫面其他地方(`clickaway`)也算一次關閉 ——
 * 這裡刻意忽略那一種:提示本來就會自己關,點一下就消失反而讓人來不及讀。
 */
export const Snackbar = ({
  open,
  message,
  severity = "success",
  autoHideDuration = 4000,
  closeLabel,
  onClose,
}: SnackbarProps) => (
  <MuiSnackbar
    open={open}
    autoHideDuration={autoHideDuration}
    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    onClose={(_event: Event | SyntheticEvent, reason?: string) => {
      if (reason === "clickaway") {
        return;
      }
      onClose();
    }}
  >
    <MuiAlert
      severity={severity}
      variant="filled"
      onClose={onClose}
      closeText={closeLabel}
      sx={{ alignItems: "center" }}
    >
      {message}
    </MuiAlert>
  </MuiSnackbar>
);
