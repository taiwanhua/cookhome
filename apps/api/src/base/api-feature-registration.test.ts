import { describe, expect, it, jest } from "@jest/globals";

import { HOOK_TIMEOUT_MS } from "../database/test-support/mongo-connection";
import {
  type ApiFeatureRegistration,
  composeApiFeatures,
} from "./api-feature-registration";

class OrgsFeature {}
class ReportsFeature {}

describe("composeApiFeatures:底座與專案功能清單的碰撞驗證", () => {
  const base: ApiFeatureRegistration[] = [{ key: "orgs", module: OrgsFeature }];

  it("兩份清單不重複:回傳底座功能的 module(依清單順序)", () => {
    expect(
      composeApiFeatures(base, [{ key: "reports", module: ReportsFeature }]),
    ).toEqual([OrgsFeature]);
  });

  it("key 空白拒絕", () => {
    expect(() =>
      composeApiFeatures(base, [{ key: " ", module: ReportsFeature }]),
    ).toThrow(/project 的功能 key 不可空白/);
  });

  it("專案拿底座的 key:拒絕並列出兩個來源", () => {
    expect(() =>
      composeApiFeatures(base, [{ key: "orgs", module: ReportsFeature }]),
    ).toThrow(/功能 key「orgs」重複:base:orgs 與 project:orgs/);
  });

  it("同一個 module 本體登記兩次(換 key 也一樣)拒絕", () => {
    expect(() =>
      composeApiFeatures(base, [{ key: "orgs-again", module: OrgsFeature }]),
    ).toThrow(/module「OrgsFeature」重複登記:base:orgs 與 project:orgs-again/);
  });

  it("同名但不同本體的 module 不算重複(以本體比較,不看 class.name)", () => {
    const sameName = { OrgsFeature: class {} }.OrgsFeature;
    expect(sameName.name).toBe(OrgsFeature.name);
    expect(() =>
      composeApiFeatures(base, [{ key: "project-orgs", module: sameName }]),
    ).not.toThrow();
  });
});

/**
 * 真入口:只替換 `project/api-modules.ts` 的內容,載入真的 `app.module.ts`。
 * 驗證寫在模組載入時,所以不合契約的清單連 AppModule 都載不進來。
 */
async function loadAppModuleWith(
  project: () => Promise<readonly ApiFeatureRegistration[]>,
): Promise<void> {
  await jest.isolateModulesAsync(async () => {
    const features = await project();
    jest.doMock("../project/api-modules", () => ({
      PROJECT_API_MODULES: features,
    }));
    await import("../app.module");
  });
}

describe("AppModule:專案功能清單不合契約時載入就失敗", () => {
  it(
    "專案功能的 key 撞底座",
    async () => {
      await expect(
        loadAppModuleWith(() =>
          Promise.resolve([{ key: "orgs", module: ReportsFeature }]),
        ),
      ).rejects.toThrow(/功能 key「orgs」重複:base:orgs 與 project:orgs/);
    },
    HOOK_TIMEOUT_MS,
  );

  it(
    "專案把底座的 module 再掛一次",
    async () => {
      await expect(
        loadAppModuleWith(async () => {
          const { OrgsModule } = await import("../orgs/orgs.module");
          return [{ key: "project-orgs", module: OrgsModule }];
        }),
      ).rejects.toThrow(/module「OrgsModule」重複登記/);
    },
    HOOK_TIMEOUT_MS,
  );

  it(
    "正式的兩份清單載得進來",
    async () => {
      await expect(
        jest.isolateModulesAsync(async () => {
          await import("../app.module");
        }),
      ).resolves.toBeUndefined();
    },
    HOOK_TIMEOUT_MS,
  );
});
