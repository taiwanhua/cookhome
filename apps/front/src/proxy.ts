import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // 略過 API route、Next 內部資源與帶副檔名的靜態檔。
  // Next 要求 config 為靜態可分析的字面值,不能用 String.raw tagged template
  // eslint-disable-next-line unicorn/prefer-string-raw
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
