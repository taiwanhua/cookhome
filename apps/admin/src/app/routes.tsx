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
import { AdminShell } from "../features/shell/admin-shell";
import { ModuleRoute } from "../features/shell/module-route";
import { modulePages } from "./module-pages";

/**
 * 路由表(#61「admin — 三頁與殼」):
 * - 公開:/login、/forgot-password、/set-password(登入線7)
 * - 已登入者的 /change-password(首登強改也走它;守門在 RequireAuth)
 * - 受保護:殼(`AdminShell`)包住 `/` 與所有模組路由;路由由 `me.modules` 決定(ADR-0011「路由與導向規則」):
 *   `/` 轉到側欄第一個能進的頁、模組路由顯示該模組頁面(`module-pages.tsx` 登記,否則佔位頁)、其餘無權限頁
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
            <AdminShell />
          </RequireAuth>
        }
      >
        <Route index element={<ModuleRoute pages={modulePages} />} />
        <Route path="*" element={<ModuleRoute pages={modulePages} />} />
      </Route>
    </Routes>
  );
}
