import { readFileSync } from "node:fs";

import { API_LOG_PATH } from "../config";
import { waitUntil } from "../harness/process";

/**
 * 從 api 的 stdout 撈啟用信的 token。
 *
 * 沒有 `RESEND_API_KEY` 時 api 用的是記錄用 adapter(ADR-0010):信不會真的寄出,
 * 連結只印在 stdout。harness 把 api 的輸出導到 `.tmp/api.log`,這裡讀它 ——
 * **e2e 不需要、也不該碰任何真的信箱或金鑰**。
 */

/** token 是 `randomBytes(32).toString("base64url")`。 */
const TOKEN_CHARS = "[A-Za-z0-9_-]+";

function findToken(email: string): string | null {
  let log: string;
  try {
    log = readFileSync(API_LOG_PATH, "utf8");
  } catch {
    return null;
  }
  const escaped = email.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const pattern = new RegExp(
    String.raw`activation → ${escaped}[\s\S]*?token=(${TOKEN_CHARS})`,
    "g",
  );
  const matches = [...log.matchAll(pattern)];
  return matches.at(-1)?.[1] ?? null;
}

/** 等這個信箱的啟用信出現在 api log 裡,回傳連結上的 token。 */
export async function waitForActivationToken(email: string): Promise<string> {
  await waitUntil(() => Promise.resolve(findToken(email) !== null), {
    label: `${email} 的啟用信`,
    timeoutMs: 30_000,
    intervalMs: 200,
  });
  const token = findToken(email);
  if (token === null) {
    throw new Error(`api log 裡找不到 ${email} 的啟用信連結`);
  }
  return token;
}
