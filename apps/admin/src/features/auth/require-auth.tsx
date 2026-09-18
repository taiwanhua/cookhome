import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useTranslations } from "use-intl";

import { CircularProgress } from "@repo/ui/circular-progress";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { loginPathWithNext } from "./paths";
import { useSession } from "./use-session";

/**
 * 路由守門:未登入 → 導 `/login?next=<原路徑>`;開機換票中 → 顯示恢復中,不閃登入頁。
 */
export function RequireAuth({ children }: Readonly<{ children: ReactNode }>) {
  const { snapshot } = useSession();
  const location = useLocation();
  const t = useTranslations("admin.session");

  if (snapshot.status === "booting") {
    return (
      <Stack
        component="main"
        spacing={2}
        sx={{
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress aria-label={t("restoring")} />
        <Typography color="text.secondary">{t("restoring")}</Typography>
      </Stack>
    );
  }

  if (snapshot.status === "anonymous") {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={loginPathWithNext(next)} replace />;
  }

  return <>{children}</>;
}
