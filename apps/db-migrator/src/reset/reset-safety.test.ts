import { describe, expect, it } from "@jest/globals";

import {
  findSafetyViolation,
  parseDatabaseName,
  resetConfirmationOf,
} from "./reset-safety";

/** 安全閥是純函式:環境允許清單與完整的人工確認字串,任一不符就回拒絕原因。 */

const target = {
  databaseName: "cookhome",
  environment: "production",
  mode: "full",
} as const;

function violationOf(
  overrides: Partial<Parameters<typeof findSafetyViolation>[0]>,
): string | null {
  return findSafetyViolation({
    ...target,
    confirm: "reset:production:cookhome:full",
    allowEnv: "dev,staging,production",
    ...overrides,
  });
}

describe("reset 的安全閥", () => {
  it("確認字串固定為 reset:<environment>:<資料庫名>:<mode>", () => {
    expect(resetConfirmationOf(target)).toBe("reset:production:cookhome:full");
  });

  it("三個環境(含 production)在允許清單內且確認完全相符時放行", () => {
    expect(violationOf({})).toBeNull();
    expect(
      violationOf({
        environment: "dev",
        databaseName: "cookhome-dev",
        mode: "data",
        confirm: "reset:dev:cookhome-dev:data",
        allowEnv: " DEV ",
      }),
    ).toBeNull();
  });

  it("環境由操作者指定,不從資料庫名推測:名字像 production 的資料庫可以是 dev 的目標,反之亦然", () => {
    expect(
      violationOf({
        environment: "dev",
        databaseName: "cookhome-prod",
        mode: "data",
        confirm: "reset:dev:cookhome-prod:data",
        allowEnv: "dev",
      }),
    ).toBeNull();
    // 資料庫名以 -dev 結尾,也不會因此把 production 的確認當成 dev
    expect(
      violationOf({
        databaseName: "cookhome-dev",
        confirm: "reset:dev:cookhome-dev:full",
      }),
    ).toContain("環境");
  });

  it("--environment 缺席或不是三個環境之一時拒絕", () => {
    expect(violationOf({ environment: undefined })).toContain("--environment");
    expect(violationOf({ environment: "qa" })).toContain("--environment");
  });

  it("RESET_ALLOW_ENV 未設或不含目標環境時拒絕(production 不再有另外的永久拒絕)", () => {
    expect(violationOf({ allowEnv: undefined })).toContain("RESET_ALLOW_ENV");
    expect(violationOf({ allowEnv: "dev,staging" })).toContain(
      "不含目標環境 production",
    );
  });

  it("--confirm 缺席、空白或任何一段不符時拒絕,並指出是哪一段", () => {
    expect(violationOf({ confirm: undefined })).toContain("--confirm");
    expect(violationOf({ confirm: "" })).toContain("--confirm");
    expect(violationOf({ confirm: "cookhome" })).toContain("格式");
    expect(violationOf({ confirm: "reset:staging:cookhome:full" })).toContain(
      "環境",
    );
    expect(violationOf({ confirm: "reset:production:other:full" })).toContain(
      "資料庫名",
    );
    expect(
      violationOf({ confirm: "reset:production:cookhome:data" }),
    ).toContain("模式");
    // 大小寫、前後空白都不算相符
    expect(
      violationOf({ confirm: "reset:production:cookhome:full " }),
    ).not.toBeNull();
    expect(
      violationOf({ confirm: "RESET:production:cookhome:full" }),
    ).not.toBeNull();
  });

  it("拒絕原因只帶資料庫名,不回顯收到的確認字串", () => {
    const pasted = "mongodb+srv://user:hunter2@host/cookhome";
    const violation = violationOf({ confirm: pasted });
    expect(violation).not.toBeNull();
    expect(violation).not.toContain("hunter2");
    expect(violation).toContain("cookhome");
  });

  it("資料庫名取自連線字串的路徑;沒有資料庫名或不是合法連線字串時丟錯且不帶出連線字串", () => {
    expect(
      parseDatabaseName(
        "mongodb+srv://user:pw@host/cookhome-staging?retryWrites=true",
      ),
    ).toBe("cookhome-staging");
    expect(parseDatabaseName("mongodb://host/some%2Dother%20db")).toBe(
      "some-other db",
    );
    expect(() => parseDatabaseName("mongodb://user:pw@host/")).toThrow(
      "未含資料庫名稱",
    );
    let message = "";
    try {
      parseDatabaseName("user:hunter2@not a uri");
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("MONGODB_URI");
    expect(message).not.toContain("hunter2");
  });
});
