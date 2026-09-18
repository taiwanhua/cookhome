import { useTranslations } from "use-intl";

import {
  PASSWORD_MIN_LENGTH,
  type PasswordRuleViolation,
} from "@repo/domain/password";
import { Box } from "@repo/ui/box";
import { TextField } from "@repo/ui/text-field";

import type { NewPasswordState } from "./use-new-password";

/** 違規項 → `admin.passwordRules.*` 文案 key */
const RULE_MESSAGE_KEY: Record<
  PasswordRuleViolation,
  "tooShort" | "digitsOnly"
> = {
  "too-short": "tooShort",
  "digits-only": "digitsOnly",
};

interface NewPasswordFieldsProps {
  state: NewPasswordState;
  /** 表單送出中:兩欄一起鎖 */
  isDisabled?: boolean;
}

/**
 * 「新密碼 + 確認新密碼」兩欄(Figma「Admin 設定新密碼」120:1587 / 120:1588):
 * 違規項逐條顯示在新密碼欄的 helper(規則與 api 同一份,`@repo/domain/password`),不一致顯示在確認欄。
 */
export function NewPasswordFields({
  state,
  isDisabled = false,
}: Readonly<NewPasswordFieldsProps>) {
  const t = useTranslations("admin.setPassword");
  const tRules = useTranslations("admin.passwordRules");
  const hasViolations = state.violations.length > 0;

  return (
    <>
      <TextField
        label={t("newPassword")}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        fullWidth
        disabled={isDisabled}
        value={state.newPassword}
        error={state.newPassword.length > 0 && hasViolations}
        helperText={
          state.newPassword.length > 0 && hasViolations
            ? state.violations.map((violation) => (
                <Box component="span" key={violation} sx={{ display: "block" }}>
                  {tRules(RULE_MESSAGE_KEY[violation], {
                    min: PASSWORD_MIN_LENGTH,
                  })}
                </Box>
              ))
            : undefined
        }
        onChange={(event) => {
          state.setNewPassword(event.target.value);
        }}
      />
      <TextField
        label={t("confirmPassword")}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        fullWidth
        disabled={isDisabled}
        value={state.confirmPassword}
        error={state.isMismatch}
        helperText={state.isMismatch ? tRules("mismatch") : undefined}
        onChange={(event) => {
          state.setConfirmPassword(event.target.value);
        }}
      />
    </>
  );
}
