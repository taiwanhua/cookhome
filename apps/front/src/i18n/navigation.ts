import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// 站內連結一律用這裡的 Link / router(自動帶語言前綴),不要用 next/link
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
