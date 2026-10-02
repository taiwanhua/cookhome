import { useCallback, useMemo, useState } from "react";

import { validatePassword } from "@repo/domain/password";
import { UserActivationMode } from "@repo/graphql";

/** 表單欄位(全部以字串持有,送出時才把空字串換成 null)。 */
export interface UserFormValues {
  account: string;
  name: string;
  nickname: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  nationalId: string;
}

export const EMPTY_USER_FORM: UserFormValues = {
  account: "",
  name: "",
  nickname: "",
  gender: "",
  email: "",
  phone: "",
  address: "",
  nationalId: "",
};

export interface UserFormState {
  values: UserFormValues;
  setValue: (field: keyof UserFormValues, value: string) => void;
  orgIds: readonly string[];
  setOrgIds: (ids: readonly string[]) => void;
  activationMode: UserActivationMode;
  setActivationMode: (mode: UserActivationMode) => void;
  initialPassword: string;
  setInitialPassword: (value: string) => void;
  /** 初始密碼的違規項(規則與 api 同一份,`@repo/domain/password`);非 PASSWORD 模式恆為空 */
  passwordViolations: ReturnType<typeof validatePassword>;
  /** 必填齊全(帳號 / 姓名 / Email / 至少一個所屬組織)且密碼規則通過 */
  isValid: boolean;
}

export interface UseUserFormOptions {
  initialValues?: UserFormValues;
  initialOrgIds?: readonly string[];
  /** 編輯模式不選啟用方式(帳號早就啟用過) */
  hasActivation: boolean;
}

/**
 * 新增 / 編輯使用者表單的狀態(Figma 202:728 / 86:162)。
 * 初始值由呼叫端在掛載時帶入 — 彈窗關閉即卸載,重開就是新的一輪,不需要 effect 同步(REACT-06)。
 */
export const useUserForm = ({
  initialValues = EMPTY_USER_FORM,
  initialOrgIds = [],
  hasActivation,
}: UseUserFormOptions): UserFormState => {
  const [values, setValues] = useState<UserFormValues>(initialValues);
  const [orgIds, setOrgIds] = useState<readonly string[]>(initialOrgIds);
  const [activationMode, setActivationMode] = useState<UserActivationMode>(
    UserActivationMode.Email,
  );
  const [initialPassword, setInitialPassword] = useState("");

  const setValue = useCallback((field: keyof UserFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  }, []);

  const isPasswordMode =
    hasActivation && activationMode === UserActivationMode.Password;
  const passwordViolations = useMemo(
    () => (isPasswordMode ? validatePassword(initialPassword) : []),
    [isPasswordMode, initialPassword],
  );

  const isValid =
    values.account.trim() !== "" &&
    values.name.trim() !== "" &&
    values.email.trim() !== "" &&
    orgIds.length > 0 &&
    passwordViolations.length === 0;

  return {
    values,
    setValue,
    orgIds,
    setOrgIds,
    activationMode,
    setActivationMode,
    initialPassword,
    setInitialPassword,
    passwordViolations,
    isValid,
  };
};
