import { type SyntheticEvent, useState } from "react";
import { useTranslations } from "use-intl";

import { useRequestPasswordResetMutation } from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Link } from "@repo/ui/link";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { AuthCard } from "../auth-card";
import { LOGIN_PATH } from "../paths";
import { useSession } from "../use-session";

/**
 * 忘記密碼頁(Figma「Admin 忘記密碼」120:1533 / 已寄出 120:1557):
 * 送出後一律顯示「已寄出」— api 對不存在的 Email 也回成功(ADR-0003 不可枚舉帳號),前端不需分流。
 */
export function ForgotPasswordPage() {
  const t = useTranslations("admin.forgotPassword");
  const { session } = useSession();

  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [hasError, setHasError] = useState(false);

  const request = useRequestPasswordResetMutation(session.publicClient, {
    onSuccess: () => {
      setIsSent(true);
    },
    onError: () => {
      setHasError(true);
    },
  });

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    setHasError(false);
    request.mutate({ input: { email: email.trim() } });
  };

  return (
    <AuthCard subtitle={t("subtitle")}>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            {isSent ? t("sent") : t("description")}
          </Typography>

          {hasError ? (
            <Alert severity="error">{t("errors.unexpected")}</Alert>
          ) : null}

          <TextField
            label={t("email")}
            name="email"
            type="email"
            autoComplete="email"
            fullWidth
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
          <Button
            type="submit"
            size="large"
            fullWidth
            disabled={request.isPending}
          >
            {isSent ? t("resend") : t("submit")}
          </Button>

          <Stack sx={{ alignItems: "center" }}>
            <Link href={LOGIN_PATH}>{t("backToLogin")}</Link>
          </Stack>
        </Stack>
      </Box>
    </AuthCard>
  );
}
