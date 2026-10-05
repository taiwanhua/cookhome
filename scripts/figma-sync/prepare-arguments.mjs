/**
 * figma-sync CLI 的參數解析:固定六命令與各自的參數白名單。
 * 禁止未知 / 重複旗標;錯誤訊息只用固定文字與白名單內的名稱,不回印 argv 原值。
 */
import { assertPathSegment } from "./artifacts.mjs";

const TARGET_KINDS = ["base-library", "brand-library", "consumer"];
const TARGETS = ["brand-bindings", "library-upgrade"];
const NODE_ID = /^[0-9A-Za-z:;]{1,200}$/;

const COMMANDS = {
  scan: { required: ["--kind", "--file-key", "--roots", "--run-id"] },
  review: {
    required: [
      "--base",
      "--brand",
      "--selections-json",
      "--review-evidence-url",
    ],
    optional: ["--consumer", "--resolutions-json"],
  },
  plan: {
    required: [
      "--base",
      "--brand",
      "--consumer",
      "--identity-review",
      "--verification-target",
    ],
    optional: [
      "--publication-evidence-json",
      "--acceptance-evidence-json",
      "--resume",
    ],
  },
  "plan-brand": { required: ["--brand"], optional: ["--resume"] },
  apply: { required: ["--plan"] },
  // --result(原協定 JSON)與 --transport-result(有界傳輸的 envelope)互斥,必須擇一
  record: {
    required: ["--request"],
    optional: ["--result", "--transport-result"],
  },
};

function reject(message) {
  const error = new Error(message);
  error.name = "FigmaSyncError";
  error.code = "ARGUMENT_INVALID";
  throw error;
}

function parseJson(name, text, wantArray) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    reject(`${name} 不是合法 JSON`);
  }
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object" && !isArray;
  if (wantArray ? !isArray : !isObject) {
    reject(`${name} 必須是單一 JSON ${wantArray ? "陣列" : "物件"}`);
  }
  return value;
}

const CONVERT = {
  "--kind": (value) =>
    TARGET_KINDS.includes(value)
      ? value
      : reject(`--kind 必須是 ${TARGET_KINDS.join(" / ")}`),
  "--file-key": (value) => assertSegment("--file-key", value),
  "--run-id": (value) => assertSegment("--run-id", value),
  "--roots": (value) => {
    const ids = value.split(",").map((id) => id.trim());
    if (ids.some((id) => !NODE_ID.test(id))) {
      reject("--roots 必須是逗號分隔的節點 ID");
    }
    return Array.from(new Set(ids));
  },
  "--verification-target": (value) =>
    TARGETS.includes(value)
      ? value
      : reject(`--verification-target 必須是 ${TARGETS.join(" / ")}`),
  "--review-evidence-url": (value) =>
    /^https:\/\/\S+$/.test(value)
      ? value
      : reject("--review-evidence-url 必須是 https URL"),
  "--selections-json": (value) => parseJson("--selections-json", value, true),
  "--resolutions-json": (value) => parseJson("--resolutions-json", value, true),
  "--publication-evidence-json": (value) =>
    parseJson("--publication-evidence-json", value, false),
  "--acceptance-evidence-json": (value) =>
    parseJson("--acceptance-evidence-json", value, false),
};

function assertSegment(name, value) {
  try {
    return assertPathSegment(value, "ARGUMENT_INVALID");
  } catch {
    return reject(`${name} 必須是單一路徑片段(英數、底線、連字號)`);
  }
}

const camel = (name) =>
  name.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

export function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!Object.hasOwn(COMMANDS, command ?? "")) {
    reject(`未知的命令(只接受 ${Object.keys(COMMANDS).join(" / ")})`);
  }
  const { required, optional = [] } = COMMANDS[command];
  const allowed = [...required, ...optional];
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (!allowed.includes(name)) {
      reject(`${command} 只接受 ${allowed.join(" / ")}`);
    }
    if (Object.hasOwn(options, camel(name))) reject(`參數 ${name} 重複`);
    if (value === undefined || value === "" || value.startsWith("--")) {
      reject(`參數 ${name} 缺少值`);
    }
    options[camel(name)] = CONVERT[name] ? CONVERT[name](value) : value;
  }
  for (const name of required) {
    if (!Object.hasOwn(options, camel(name))) {
      reject(`${command} 需要 ${name}`);
    }
  }
  if (options.resolutionsJson && !options.consumer) {
    reject("--resolutions-json 需要同時提供 --consumer");
  }
  const evidence = [
    options.publicationEvidenceJson,
    options.acceptanceEvidenceJson,
  ].filter(Boolean).length;
  if (options.verificationTarget === "library-upgrade" && evidence !== 2) {
    reject(
      "library-upgrade 需要 --publication-evidence-json 與 --acceptance-evidence-json",
    );
  }
  if (command === "record") {
    const given = [options.result, options.transportResult].filter(Boolean);
    if (given.length !== 1) {
      reject("record 需要 --result 或 --transport-result 其中一個");
    }
  }
  return { command, options };
}
