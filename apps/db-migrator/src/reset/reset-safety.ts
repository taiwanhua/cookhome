/**
 * reset 指令的安全閥(正本:ADR-0002「還原(reset)」)。
 *
 * 純函式、不碰資料庫:只看連線字串裡的資料庫名 + `--confirm` + `RESET_ALLOW_ENV`,
 * 決定放行或拒絕。三道閥依序檢查,任一不過即回傳拒絕原因(入口據此 exit 1)。
 */

/** 三個環境(對照表正本:docs/deployment.md「環境對照(分支 ↔ 環境)」)。 */
export type ResetEnvironment = "dev" | "staging" | "production";

/** 允許還原的環境名單(逗號分隔),正本:docs/env-registry.md。 */
export const RESET_ALLOW_ENV_NAME = "RESET_ALLOW_ENV";

/** 從 `MONGODB_URI` 取出資料庫名(seed 也以它決定寫哪個庫:`client.db()`)。 */
export function parseDatabaseName(uri: string): string {
  const name = decodeURIComponent(new URL(uri).pathname.replace(/^\//, ""));
  if (name === "") {
    throw new Error(
      "MONGODB_URI 未含資料庫名稱(例:mongodb://127.0.0.1:27017/cookhome-dev)",
    );
  }
  return name;
}

/**
 * 由資料庫名推得目標環境:`-dev` / `-staging` 結尾即該環境,**其餘一律視為 production**
 * —— production 的資料庫名是沒有後綴的 `cookhome`(docs/deployment.md 環境對照),
 * 認不出來的名字取最嚴格的那一邊才不會誤刪;名稱含 `prod` 字樣者同樣是 production。
 */
export function resolveEnvironment(databaseName: string): ResetEnvironment {
  const name = databaseName.toLowerCase();
  if (name.includes("prod")) {
    return "production";
  }
  if (name.endsWith("-dev")) {
    return "dev";
  }
  if (name.endsWith("-staging")) {
    return "staging";
  }
  return "production";
}

/** `RESET_ALLOW_ENV` 的值(逗號分隔;未設 = 空名單 = 全部拒絕)。 */
export function parseAllowedEnvironments(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "");
}

export interface ResetSafetyInput {
  /** 連線字串裡的資料庫名。 */
  databaseName: string;
  /** `--confirm` 的值(未給為 undefined)。 */
  confirm: string | undefined;
  /** `RESET_ALLOW_ENV` 的原始值。 */
  allowEnv: string | undefined;
}

/** 回傳拒絕原因;`null` = 三道閥全過。 */
export function findSafetyViolation({
  databaseName,
  confirm,
  allowEnv,
}: ResetSafetyInput): string | null {
  if (confirm !== databaseName) {
    return `--confirm 必須等於連線字串的資料庫名(預期 ${databaseName},收到 ${confirm ?? "(未給)"})`;
  }

  const environment = resolveEnvironment(databaseName);
  if (environment === "production") {
    return `資料庫 ${databaseName} 判定為 production(名稱含 prod,或不以 -dev / -staging 結尾),reset 永不對 production 執行`;
  }

  const allowed = parseAllowedEnvironments(allowEnv);
  if (!allowed.includes(environment)) {
    return `${RESET_ALLOW_ENV_NAME}(目前:${allowEnv ?? "(未設)"})不含目標環境 ${environment}`;
  }

  return null;
}
