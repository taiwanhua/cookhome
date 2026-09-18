import { Route, Routes } from "react-router";

import { ChangePasswordPage } from "../features/auth/change-password-page";
import { ForgotPasswordPage } from "../features/auth/forgot-password-page";
import { LoginPage } from "../features/auth/login-page";
import {
  CHANGE_PASSWORD_PATH,
  FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
  SET_PASSWORD_PATH,
} from "../features/auth/paths";
import { RequireAuth } from "../features/auth/require-auth";
import { SetPasswordPage } from "../features/auth/set-password-page";
import { HomePage } from "../features/home";

/**
 * 路由表(#61「admin — 三頁與殼」):登入線的公開頁(/login、/forgot-password、/set-password)、
 * 已登入者的 /change-password(首登強改也走它)、首頁佔位;其餘路由由模組陣列產生(登入線5)。
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={LOGIN_PATH} element={<LoginPage />} />
      <Route path={FORGOT_PASSWORD_PATH} element={<ForgotPasswordPage />} />
      <Route path={SET_PASSWORD_PATH} element={<SetPasswordPage />} />
      <Route
        path={CHANGE_PASSWORD_PATH}
        element={
          <RequireAuth>
            <ChangePasswordPage />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
