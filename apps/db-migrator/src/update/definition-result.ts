/**
 * 受管定義 CLI 一次輸出的驗收(純函式;子程序的啟動在 `definition-client.ts`)。
 *
 * 結果要逐筆對回請求(種類、key、revision、兩個 hash、順序):少一筆、多一筆、重複、對不上、
 * 子程序非零結束或任何 `errors` / 衝突都算整批失敗 —— 不會把沒做完的記成成功。
 */
import {
  type DefinitionSeedItemResult,
  type DefinitionSeedOutcome,
  DefinitionSeedProtocolError,
  type DefinitionSeedRequest,
  type DefinitionSeedSet,
  definitionSeedId,
  isDefinitionInstalled,
  parseDefinitionSeedResult,
} from "@repo/domain/seed";

import { definitionHashesOf } from "./content-hash";

/** 失敗訊息裡附的子程序診斷(stderr 尾端)上限。 */
const DIAGNOSTIC_TAIL = 2000;

/** 子程序失敗、結果格式不符、對不回請求,或 api 回報錯誤 / 衝突。 */
export class DefinitionSeedCliError extends Error {
  override name = "DefinitionSeedCliError";
}

export interface DefinitionCliOutput {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** 已安裝的一筆(映射齊全)。 */
export type InstalledDefinitionResult = DefinitionSeedItemResult & {
  definitionId: string;
  localVersion: number;
  outcome: DefinitionSeedOutcome;
};

/** 子程序的診斷只在失敗時附上(成功時不轉印到這個程序的 stderr)。 */
export function diagnosticOf(output: DefinitionCliOutput): string {
  const tail = output.stderr.trim().slice(-DIAGNOSTIC_TAIL);
  return tail === "" ? "" : `\n子程序診斷:\n${tail}`;
}

/** 回報的項目與請求逐筆對應;對不上的地方列成問題。 */
function correspondenceProblems(
  seeds: readonly DefinitionSeedSet[],
  results: readonly DefinitionSeedItemResult[],
): string[] {
  const problems: string[] = [];
  const requested = new Map(
    seeds.map((seed) => [definitionSeedId(seed), definitionHashesOf(seed)]),
  );
  const reported = new Set<string>();
  for (const [index, item] of results.entries()) {
    const id = definitionSeedId(item);
    const hashes = requested.get(id);
    if (hashes === undefined) {
      problems.push(`回報了請求裡沒有的 ${id}`);
      continue;
    }
    if (reported.has(id)) {
      problems.push(`${id} 重複回報`);
      continue;
    }
    reported.add(id);
    const expected = seeds[index];
    if (expected === undefined || definitionSeedId(expected) !== id) {
      problems.push(`${id} 的順序與請求不同`);
    }
    if (
      item.contentHash !== hashes.contentHash ||
      item.snapshotHash !== hashes.snapshotHash
    ) {
      problems.push(`${id} 回報的 hash 與送出的宣告不同`);
    }
  }
  for (const id of requested.keys()) {
    if (!reported.has(id)) {
      problems.push(`${id} 沒有回報結果`);
    }
  }
  return problems;
}

/** api 回報的 `errors` 與各筆衝突(有任何一項就是整批失敗)。 */
function reportedFailures(
  result: ReturnType<typeof parseDefinitionSeedResult>,
): string[] {
  return [
    ...result.errors.map(({ code, message, kind, key, revision }) => {
      const target =
        kind !== undefined && key !== undefined && revision !== undefined
          ? `${definitionSeedId({ kind, key, revision })}:`
          : "";
      return `${target}${message}(${code})`;
    }),
    ...result.results.flatMap((item) =>
      item.conflict === null
        ? []
        : [
            `${definitionSeedId(item)}:${item.conflict.message}(${item.conflict.code})`,
          ],
    ),
  ];
}

/**
 * 驗收一次子程序的輸出:回每一份宣告的結果(順序同請求)。`apply` 的每一筆都必須是已安裝;
 * `inspect` 可以是已安裝或尚未安裝(`absent`)。任何一項不合就丟 `DefinitionSeedCliError`。
 */
export function matchDefinitionSeedResult(
  request: Pick<DefinitionSeedRequest, "operation" | "seeds">,
  output: DefinitionCliOutput,
): DefinitionSeedItemResult[] {
  const { operation, seeds } = request;
  const label = `受管定義 CLI(${operation})`;
  let result;
  try {
    result = parseDefinitionSeedResult(JSON.parse(output.stdout), operation);
  } catch (error) {
    if (
      error instanceof DefinitionSeedProtocolError ||
      error instanceof SyntaxError
    ) {
      throw new DefinitionSeedCliError(
        `${label}的輸出不是合法的結果(exit ${String(output.status)}):${error.message}${diagnosticOf(output)}`,
      );
    }
    throw error;
  }
  const failures = reportedFailures(result);
  if (failures.length > 0) {
    throw new DefinitionSeedCliError(
      `${label}回報失敗,未完成的不會被記成成功:\n- ${failures.join("\n- ")}${diagnosticOf(output)}`,
    );
  }
  if (output.status !== 0) {
    throw new DefinitionSeedCliError(
      `${label}以 exit ${String(output.status)} 結束${diagnosticOf(output)}`,
    );
  }
  const problems = correspondenceProblems(seeds, result.results);
  if (operation === "apply") {
    problems.push(
      ...result.results
        .filter((item) => !isDefinitionInstalled(item))
        .map((item) => `${definitionSeedId(item)} 沒有完成安裝`),
    );
  }
  if (problems.length > 0) {
    throw new DefinitionSeedCliError(
      `${label}的結果對不回請求:\n- ${problems.join("\n- ")}`,
    );
  }
  return result.results;
}
