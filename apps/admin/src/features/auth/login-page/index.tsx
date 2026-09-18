import { type SyntheticEvent, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useTranslations } from "use-intl";

import { useLoginMutation } from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Link } from "@repo/ui/link";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { NEXT_PARAM, safeNextPath } from "../paths";
import { useSession } from "../use-session";
import { type LoginErrorKey, loginErrorKeyOf } from "./login-error";

/** 登入頁(Figma「Admin 登入 LoginCard」17:4;品牌文字登記於 docs/branding.md)。 */
export function LoginPage() {
  const t = useTranslations("admin.login");
  const tCommon = useTranslations("common");
  const { session, snapshot } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = safeNextPath(searchParams.get(NEXT_PARAM));

  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState<LoginErrorKey | null>(null);

  const login = useLoginMutation(session.publicClient, {
    onSuccess: ({ login: payload }) => {
      session.store.setAccessToken(payload.accessToken);
      void navigate(nextPath, { replace: true });
    },
    onError: (error: unknown) => {
      setErrorKey(loginErrorKeyOf(error));
    },
  });

  if (snapshot.status === "authenticated") {
    return <Navigate to={nextPath} replace />;
  }

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    setErrorKey(null);
    login.mutate({ input: { account, password } });
  };

  return (
    <Stack
      component="main"
      spacing={3}
      sx={{
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 400,
          p: 5,
          boxShadow: (theme) => theme.customShadows.dialog,
        }}
      >
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <Stack spacing={0.5} sx={{ alignItems: "center" }}>
              <Typography variant="h4" color="primary">
                {tCommon("brand")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("subtitle")}
              </Typography>
            </Stack>

            {errorKey === null ? null : (
              <Alert severity="error">{t(`errors.${errorKey}`)}</Alert>
            )}

            <TextField
              label={t("account")}
              name="account"
              autoComplete="username"
              fullWidth
              value={account}
              onChange={(event) => {
                setAccount(event.target.value);
              }}
            />
            <TextField
              label={t("password")}
              name="password"
              type="password"
              autoComplete="current-password"
              fullWidth
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />
            <Button
              type="submit"
              size="large"
              fullWidth
              disabled={login.isPending}
            >
              {t("submit")}
            </Button>

            <Stack sx={{ alignItems: "center" }}>
              <Link href="/forgot-password">{t("forgotPassword")}</Link>
            </Stack>
          </Stack>
        </Box>
      </Card>

      <Typography variant="caption" color="text.disabled">
        {t("footer", {
          year: new Date().getFullYear(),
          brand: tCommon("brand"),
        })}
      </Typography>
    </Stack>
  );
}
