/**
 * reset 指令入口(`pnpm --filter @repo/db-migrator reset …`;用法與流程見 `command.ts`)。
 *
 * 以 tsx 直跑。三個環境(含 production)都要 `--environment`、`RESET_ALLOW_ENV` 允許清單與完整的
 * `--confirm=reset:<environment>:<資料庫名>:<mode>`;缺任何一項或任何一段不符即 exit 1,一筆都不刪。
 */
import { runResetEntry } from "./command";

await runResetEntry(process.argv.slice(2));
