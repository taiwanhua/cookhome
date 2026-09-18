import { useCallback, useMemo, useState } from "react";

import {
  type PasswordRuleViolation,
  validatePassword,
} from "@repo/domain/password";

export interface NewPasswordState {
  newPassword: string;
  confirmPassword: string;
  setNewPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  /** 目前新密碼的違規項(規則正本 `@repo/domain/password`,與 api 同一份);輸入即時更新 */
  violations: PasswordRuleViolation[];
  /** 兩次輸入不一致(只在確認欄有輸入、或按過送出後才算) */
  isMismatch: boolean;
  /** 是否可送出:無違規且兩次一致 */
  isValid: boolean;
  /** 送出前呼叫:標記已嘗試送出(讓「不一致」提示出現),回傳是否通過 */
  submitAttempt: () => boolean;
  /** api 仍回 VALIDATION_FAILED 時(規則漂移),把它的違規項疊上來顯示 */
  applyServerViolations: (violations: PasswordRuleViolation[]) => void;
}

/** 「新密碼 + 確認新密碼」兩欄的狀態與即時驗證(設定新密碼頁、改密碼頁共用)。 */
export const useNewPassword = (): NewPasswordState => {
  const [newPassword, setNewPasswordValue] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasSubmitAttempt, setHasSubmitAttempt] = useState(false);
  const [serverViolations, setServerViolations] = useState<
    PasswordRuleViolation[]
  >([]);

  const violations = useMemo(() => {
    const local = validatePassword(newPassword);
    const extra = serverViolations.filter((item) => !local.includes(item));
    return [...local, ...extra];
  }, [newPassword, serverViolations]);

  const isMismatch =
    newPassword !== confirmPassword &&
    (confirmPassword.length > 0 || hasSubmitAttempt);
  const isValid = violations.length === 0 && newPassword === confirmPassword;

  const setNewPassword = useCallback((value: string) => {
    setNewPasswordValue(value);
    setServerViolations([]);
  }, []);

  const submitAttempt = useCallback(() => {
    setHasSubmitAttempt(true);
    return isValid;
  }, [isValid]);

  return {
    newPassword,
    confirmPassword,
    setNewPassword,
    setConfirmPassword,
    violations,
    isMismatch,
    isValid,
    submitAttempt,
    applyServerViolations: setServerViolations,
  };
};
