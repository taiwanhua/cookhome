export {
  PASSWORD_MIN_LENGTH,
  type PasswordRuleViolation,
  isPasswordValid,
  validatePassword,
} from "./validate-password";

// CI probe(#518 驗證用,不合併)
export const   ciProbeBadFormat=1
