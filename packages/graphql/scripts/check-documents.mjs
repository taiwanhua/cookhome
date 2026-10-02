// codegen 寫產物之前的文件登記檢查:底座(base)與專案(project)兩個來源共用一份 generated,
// loader 遇到同名定義可能直接合併,所以在這裡先擋。規則兩個來源相同,不以檔案順序決定勝者:
// - 文件只能放在 documents/base/ 或 documents/project/ 底下(可有子目錄),不可散落在來源根目錄
// - 來源樹裡不可有 symbolic link
// - operation 必須具名;operation、fragment 的名稱各自全域唯一,內容完全相同的重名也拒絕
// 檔名不是 operation 的身分,只有定義的名稱才是。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { GraphQLError, Kind, Source, getLocation, parse } from "graphql";

export const DOCUMENT_ZONES = ["base", "project"];

const DOCUMENT_EXTENSION = ".graphql";
const ZONE_HINT = DOCUMENT_ZONES.map((zone) => `${zone}/`).join(" 或 ");

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(scriptPath), "..");

/**
 * 依名稱排序後遞迴列出目錄下的 `.graphql` 檔,結果不受檔案系統回傳順序影響。
 * symbolic link(檔案或目錄)一律拒絕:codegen 的 loader 會跟著連結讀進去,
 * 這裡若只是略過,loader 就會讀到沒驗過的來源。
 */
function listDocumentFiles(directory, display, errors) {
  const entries = readdirSync(directory, { withFileTypes: true }).toSorted(
    (a, b) => (a.name < b.name ? -1 : 1),
  );
  return entries.flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(
        `${display(file)}:文件來源不可使用 symbolic link,請改放實際檔案或目錄`,
      );
      return [];
    }
    if (entry.isDirectory()) return listDocumentFiles(file, display, errors);
    return entry.isFile() && entry.name.endsWith(DOCUMENT_EXTENSION)
      ? [file]
      : [];
  });
}

function readDefinitions(file, displayPath, zone, errors) {
  const source = new Source(readFileSync(file, "utf8"), displayPath);
  const at = ({ line, column }) => `${displayPath}:${line}:${column}(${zone})`;

  let document;
  try {
    document = parse(source);
  } catch (error) {
    if (!(error instanceof GraphQLError)) throw error;
    const location = error.locations?.[0] ?? { line: 1, column: 1 };
    errors.push(`${at(location)}:GraphQL 語法錯誤:${error.message}`);
    return [];
  }

  return document.definitions.flatMap((definition) => {
    const location = at(getLocation(source, definition.loc.start));
    const isOperation = definition.kind === Kind.OPERATION_DEFINITION;
    if (!isOperation && definition.kind !== Kind.FRAGMENT_DEFINITION) {
      errors.push(
        `${location}:只能放 operation 或 fragment,不可放 ${definition.kind}`,
      );
      return [];
    }
    if (!definition.name) {
      errors.push(`${location}:匿名 operation 不可登記,請替它命名`);
      return [];
    }
    return [
      {
        kind: isOperation ? "operation" : "fragment",
        name: definition.name.value,
        zone,
        path: displayPath,
        location,
      },
    ];
  });
}

/**
 * 檢查 `documentsRoot` 底下的 GraphQL 文件;不丟例外,問題全部收進 `errors` 一次回報。
 * 診斷裡的路徑是相對 `relativeTo` 的 POSIX 路徑。
 */
export function checkDocuments({ documentsRoot, relativeTo = process.cwd() }) {
  const display = (file) =>
    path.relative(relativeTo, file).replaceAll("\\", "/");
  const errors = [];
  const definitions = [];

  if (!existsSync(documentsRoot)) {
    return {
      errors: [`${display(documentsRoot)}:找不到 GraphQL 文件來源根目錄`],
      definitions,
    };
  }

  for (const file of listDocumentFiles(documentsRoot, display, errors)) {
    const displayPath = display(file);
    const segments = path.relative(documentsRoot, file).split(/[\\/]/);
    if (segments.length === 1) {
      errors.push(
        `${displayPath}:文件必須放在 ${ZONE_HINT} 底下,不可散落在來源根目錄`,
      );
      continue;
    }
    const [zone] = segments;
    if (!DOCUMENT_ZONES.includes(zone)) {
      errors.push(
        `${displayPath}:未知的來源區域「${zone}」,文件必須放在 ${ZONE_HINT} 底下`,
      );
      continue;
    }
    definitions.push(...readDefinitions(file, displayPath, zone, errors));
  }

  // operation 與 fragment 是兩個命名空間;query / mutation / subscription 共用 operation 的
  const byName = new Map();
  for (const definition of definitions) {
    const key = `${definition.kind}:${definition.name}`;
    byName.set(key, [...(byName.get(key) ?? []), definition]);
  }
  for (const [first, ...rest] of byName.values()) {
    if (rest.length === 0) continue;
    const locations = [first, ...rest].map(({ location }) => location);
    errors.push(
      `${first.kind}「${first.name}」重複定義:${locations.join("、")}`,
    );
  }

  return { errors, definitions };
}

function main([root]) {
  const { errors, definitions } = checkDocuments(
    root
      ? { documentsRoot: path.resolve(root) }
      : {
          documentsRoot: path.join(packageRoot, "src", "documents"),
          relativeTo: packageRoot,
        },
  );
  if (errors.length > 0) {
    const lines = errors.map((error) => `- ${error}`).join("\n");
    process.stderr.write(
      `GraphQL 文件檢查失敗(${errors.length} 個問題),未產生任何產物:\n${lines}\n`,
    );
    process.exitCode = 1;
    return;
  }
  const counts = DOCUMENT_ZONES.map((zone) => {
    const count = definitions.filter(
      (definition) => definition.zone === zone,
    ).length;
    return `${zone} ${count}`;
  });
  process.stdout.write(
    `GraphQL 文件檢查通過:${definitions.length} 個定義(${counts.join("、")})\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main(process.argv.slice(2));
}
