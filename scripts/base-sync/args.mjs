/** 命令列解析。錯誤訊息只用固定文字與白名單內的參數名,不回印 argv 原值。 */
import { fail } from "./errors.mjs";

const COMMANDS = {
  inspect: { "--project": "project", "--from": "from", "--to": "to" },
  upgrade: {
    "--project": "projects",
    "--tag": "tag",
    "--worktree-root": "worktreeRoot",
  },
  contribute: {
    "--project": "project",
    "--commit": "commit",
    "--base": "base",
    "--worktree-root": "worktreeRoot",
  },
};

/** 可重複的參數(輸出成陣列)。 */
const REPEATABLE = new Set(["projects"]);

export function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!Object.hasOwn(COMMANDS, command ?? "")) {
    fail(`命令必須是 ${Object.keys(COMMANDS).join(" / ")}`);
  }
  const spec = COMMANDS[command];
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (!Object.hasOwn(spec, name)) {
      fail(
        `${command} 不接受這個參數(只接受 ${Object.keys(spec).join(" / ")})`,
      );
    }
    if (value === undefined || value === "" || value.startsWith("-")) {
      fail(`參數 ${name} 缺少值`);
    }
    const key = spec[name];
    if (REPEATABLE.has(key)) {
      options[key] = [...(options[key] ?? []), value];
    } else if (Object.hasOwn(options, key)) {
      fail(`參數 ${name} 重複`);
    } else {
      options[key] = value;
    }
  }
  for (const [name, key] of Object.entries(spec)) {
    if (!Object.hasOwn(options, key)) fail(`${command} 需要 ${name}`);
  }
  return { command, options };
}
