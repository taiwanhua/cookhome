import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import { projectSeedSettings } from "../../seeds/project/settings";
import { seedRegistry } from "../../seeds/registry";
import {
  BUILD_TIMEOUT_MS,
  SEED_ENTRY,
  TestMongo,
  buildDefinitionCli,
  documentsOf,
  startEntry,
} from "../../test/support/update-harness";
import { isDefinitionSeedSet } from "./seed-declaration";

/**
 * 正式 registry(`seeds/registry.ts`:底座 + 引用專案在 `seeds/project/` 登記的內容)對真的拋棄式 MongoDB。
 *
 * 這裡驗的是「目前的宣告合法、能交付」,期望值一律從正式來源本身推出:專案登記了模組、普通種子或定義,
 * 這個檔照樣要綠。底座自己的固定數量與落庫細節用空專案來源的夾具驗(`seed.test.ts`),不寫在這裡。
 * 專案若登記了版本化定義,seed 指令經 api 的受管定義 CLI 發布,所以先建置。
 */

const mongo = new TestMongo("db-migrator-seed-formal");

/** 正式 registry 的每個 documents collection:識別鍵欄位與它宣告的全部識別鍵。 */
const declaredKeys = new Map<string, { keyField: string; keys: string[] }>();
for (const set of seedRegistry) {
  if (set.kind === "documents") {
    const declared = declaredKeys.get(set.collection) ?? {
      keyField: set.keyField ?? "key",
      keys: [],
    };
    declared.keys.push(...set.entries.map((entry) => entry.key));
    declaredKeys.set(set.collection, declared);
  }
}

const definitions = seedRegistry.filter((set) => isDefinitionSeedSet(set));

function runSeedCommand(databaseUri: string) {
  return startEntry(SEED_ENTRY, [], databaseUri).done;
}

const sorted = (values: string[]): string[] =>
  values.toSorted((left, right) => left.localeCompare(right, "zh-Hant"));

beforeAll(async () => {
  await mongo.start();
  await buildDefinitionCli();
}, BUILD_TIMEOUT_MS);

afterAll(async () => {
  await mongo.stop();
}, 60_000);

describe("正式 registry 的 seed 指令(對真 MongoDB)", () => {
  it("空資料庫:宣告的每一筆種子都落庫(不多不少)、根組織用專案初值、登記的定義都有安裝紀錄;重跑全部未變、id 不動", async () => {
    const databaseUri = mongo.uri("fresh");

    const firstRun = await runSeedCommand(databaseUri);
    expect(firstRun.stderr).toBe("");
    expect(firstRun.status).toBe(0);

    const seededIds: Record<string, string[]> = {};
    for (const [collection, { keyField, keys }] of declaredKeys) {
      const seeded = await documentsOf(databaseUri, collection, {
        isSystem: true,
      });
      expect(
        sorted(seeded.map((document) => String(document[keyField]))),
      ).toEqual(sorted(keys));
      seededIds[collection] = seeded.map((document) => String(document._id));
    }

    const [rootOrg] = await documentsOf(databaseUri, "orgs", { key: "root" });
    expect(rootOrg).toMatchObject({
      name: projectSeedSettings.rootOrg.name,
      description: projectSeedSettings.rootOrg.description,
      settings: projectSeedSettings.rootOrg.settings,
      parentId: null,
      isSystem: true,
    });

    const installations = await documentsOf(
      databaseUri,
      "seed_definition_installations",
    );
    expect(
      sorted(
        installations.map(
          ({ kind, key, revision, status }) =>
            `${String(kind)}:${String(key)}@${String(revision)}:${String(status)}`,
        ),
      ),
    ).toEqual(
      sorted(
        definitions.map(
          (set) => `${set.kind}:${set.key}@${set.revision}:installed`,
        ),
      ),
    );

    const secondRun = await runSeedCommand(databaseUri);
    expect(secondRun.stderr).toBe("");
    expect(secondRun.status).toBe(0);
    expect(secondRun.stdout).toMatch(
      /seed 完成:新增 0 \/ 更新 0 \/ 認養 0 \/ 未變 [1-9]\d*\n/,
    );
    for (const collection of declaredKeys.keys()) {
      const seeded = await documentsOf(databaseUri, collection, {
        isSystem: true,
      });
      expect(seeded.map((document) => String(document._id))).toEqual(
        seededIds[collection],
      );
    }
  }, 300_000);
});
