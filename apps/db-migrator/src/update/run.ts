/**
 * update 指令入口(`pnpm --filter @repo/db-migrator run update`;用法見 `command.ts`)。
 *
 * 以 tsx 直跑。`migrate` 是同一支入口的別名(`--alias=migrate` 只換訊息的前綴),
 * `migrate:status`、`migrate:down` 是它的 `--status`、`--down`。
 */
import { runUpdateEntry } from "./command";

const ALIAS_FLAG = "--alias=";

const argv = process.argv.slice(2);
const alias = argv.find((argument) => argument.startsWith(ALIAS_FLAG));

await runUpdateEntry(
  argv.filter((argument) => argument !== alias),
  { label: alias === undefined ? "update" : alias.slice(ALIAS_FLAG.length) },
);
