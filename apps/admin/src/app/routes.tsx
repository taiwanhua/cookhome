import { Route, Routes } from "react-router";

import { LoginPage } from "../features/auth/login-page";
import { LOGIN_PATH } from "../features/auth/paths";
import { RequireAuth } from "../features/auth/require-auth";
import { HomePage } from "../features/home";

/** 路由表(#61「admin — 三頁與殼」):本票只有 /login 與首頁佔位;其餘路由由模組陣列產生(登入線5)。 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={LOGIN_PATH} element={<LoginPage />} />
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
