export const LOGIN_PATH = "/login";
export const NEXT_PARAM = "next";

/** 未登入時導向的登入頁網址,帶原路徑供登入後回去(#61:`/login?next=<原路徑>`)。 */
export function loginPathWithNext(next: string): string {
  return `${LOGIN_PATH}?${NEXT_PARAM}=${encodeURIComponent(next)}`;
}

/** `next` 只接受站內相對路徑(防 open redirect);其他一律回首頁。 */
export function safeNextPath(next: string | null): string {
  return next !== null && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/";
}
