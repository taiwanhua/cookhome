import { describe, expect, it } from "@jest/globals";
import type { InjectionToken, Provider } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import {
  Schema as NestSchema,
  Prop,
  SchemaFactory,
  getModelToken,
} from "@nestjs/mongoose";
import { Schema, type SchemaDefinition, Types, model } from "mongoose";

import { BaseRepository, type RepositoryDocument } from "./base.repository";
import { OrgBusinessDataReader } from "./org-business-data.reader";
import { baseFieldsPlugin } from "./plugins/base-fields.plugin";
import {
  type TenantScopeOptions,
  tenantScopePlugin,
} from "./plugins/tenant-scope.plugin";
import {
  type DatabaseRegistration,
  type LegacyUnscopedModel,
  composeDatabaseRegistrations,
} from "./registration";

/** 示範模組形狀的專案租戶 schema:先定 collection、再掛 baseFields 與 tenantScope。 */
function tenantSchema(
  collection: string,
  options?: TenantScopeOptions,
): Schema {
  const schema = new Schema(
    { orgId: { type: Schema.Types.ObjectId, required: true }, name: String },
    { collection },
  );
  schema.plugin(baseFieldsPlugin);
  schema.plugin(tenantScopePlugin, options ?? { moduleData: true });
  return schema;
}

class ItemsRepository extends BaseRepository<unknown, RepositoryDocument> {}
class OtherItemsRepository extends BaseRepository<
  unknown,
  RepositoryDocument
> {}

interface TenantRegistrationOptions {
  key?: string;
  modelName?: string;
  collection?: string;
  schema?: Schema;
  repository?: Provider;
  checkKey?: string;
}

/** 一份合規的專案登記(一張表、一個 repository、一項組織歸屬檢查)。 */
function tenantRegistration(
  options: TenantRegistrationOptions = {},
): DatabaseRegistration {
  const modelName = options.modelName ?? "Item";
  const collection = options.collection ?? "items";
  const repository = options.repository ?? ItemsRepository;
  return {
    key: options.key ?? "items",
    models: [
      {
        name: modelName,
        collection,
        schema: options.schema ?? tenantSchema(collection),
      },
    ],
    repositories: [{ modelName, provider: repository }],
    orgDataChecks: [
      {
        key: options.checkKey ?? "items.org",
        modelName,
        repository:
          typeof repository === "function" ? repository : repository.provide,
        ownerField: "orgId",
      },
    ],
  };
}

/** 以指定 token 登記 repository 的組裝動作(給 `expect(...).toThrow` 用)。 */
function composeWithToken(provide: InjectionToken): () => unknown {
  return () =>
    composeDatabaseRegistrations(
      [],
      [
        tenantRegistration({
          repository: { provide, useClass: ItemsRepository },
        }),
      ],
    );
}

/** 底座登記不受專案租戶要求約束(全域表、專用 adapter 都合法)。 */
function baseRegistration(
  key = "base",
  modelName = "Setting",
  collection = "settings",
): DatabaseRegistration {
  return {
    key,
    models: [
      { name: modelName, collection, schema: new Schema({}, { collection }) },
    ],
    repositories: [],
    orgDataChecks: [],
  };
}

describe("composeDatabaseRegistrations:資料登記的組裝與碰撞驗證", () => {
  it("合規的底座 + 專案登記:導出 model、provider、exports 與檢查,schema 沿用原 instance", () => {
    const base = baseRegistration();
    const project = tenantRegistration();
    const snapshot = JSON.stringify({ base, project });

    const composed = composeDatabaseRegistrations([base], [project]);

    expect(composed.models.map((model) => model.name)).toEqual([
      "Setting",
      "Item",
    ]);
    // 不 clone、不補掛:forFeature 拿到的就是登記的那個 schema
    expect(composed.models[1]?.schema).toBe(project.models[0]?.schema);
    expect(composed.providers).toEqual([ItemsRepository]);
    expect(composed.exports).toEqual([ItemsRepository]);
    expect(composed.orgDataChecks).toEqual([
      {
        key: "items.org",
        modelName: "Item",
        collection: "items",
        repository: ItemsRepository,
        ownerField: "orgId",
      },
    ]);
    expect(composed.projectRepositories).toEqual([
      { token: ItemsRepository, modelName: "Item", collection: "items" },
    ]);
    expect(JSON.stringify({ base, project })).toBe(snapshot);
  });

  it("多個 repository 可共用同一張 model(既有 adapter 的形狀)", () => {
    const registration = tenantRegistration();
    const composed = composeDatabaseRegistrations(
      [],
      [
        {
          ...registration,
          repositories: [
            ...registration.repositories,
            { modelName: "Item", provider: OtherItemsRepository },
          ],
        },
      ],
    );
    expect(composed.exports).toEqual([ItemsRepository, OtherItemsRepository]);
  });

  describe("碰撞:任一重複都拒絕,不以順序決定勝者", () => {
    it("登記 key 空白或重複(底座與專案相撞也算)", () => {
      expect(() =>
        composeDatabaseRegistrations([], [tenantRegistration({ key: " " })]),
      ).toThrow(/登記 key 不可空白/);
      expect(() =>
        composeDatabaseRegistrations(
          [baseRegistration("items")],
          [tenantRegistration({ key: "items" })],
        ),
      ).toThrow(/登記 key「items」重複.*base.*project/);
    });

    it("model name 重複", () => {
      expect(() =>
        composeDatabaseRegistrations(
          [baseRegistration("base", "Item", "base_items")],
          [tenantRegistration()],
        ),
      ).toThrow(/model「Item」重複/);
    });

    it("實際 collection 重複(model 名不同也拒絕)", () => {
      expect(() =>
        composeDatabaseRegistrations(
          [baseRegistration("base", "Setting", "items")],
          [tenantRegistration()],
        ),
      ).toThrow(/collection「items」重複/);
    });

    it("登記的 collection 與 schema 選項不一致", () => {
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [
            tenantRegistration({
              collection: "items",
              schema: tenantSchema("other_items"),
            }),
          ],
        ),
      ).toThrow(/Item.*collection「items」與 schema 選項「other_items」不一致/);
    });

    it("repository token 以本體比較:同一個 class 重複登記才拒絕,同名不同 class 不算", () => {
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [
            tenantRegistration(),
            tenantRegistration({
              key: "items-two",
              modelName: "ItemTwo",
              collection: "items_two",
              checkKey: "items-two.org",
            }),
          ],
        ),
      ).toThrow(/repository token「ItemsRepository」重複/);

      // 兩個 class 的 name 都是 ItemsRepository,但本體不同 → 不算碰撞
      const sameName = {
        ItemsRepository: class extends BaseRepository<
          unknown,
          RepositoryDocument
        > {},
      }.ItemsRepository;
      expect(sameName.name).toBe(ItemsRepository.name);
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [
            tenantRegistration(),
            tenantRegistration({
              key: "items-two",
              modelName: "ItemTwo",
              collection: "items_two",
              checkKey: "items-two.org",
              repository: sameName,
            }),
          ],
        ),
      ).not.toThrow();
    });

    it("repository token 撞 model token、組裝器內部 token 或 Nest 全域 token", () => {
      expect(composeWithToken(getModelToken("Item"))).toThrow(
        /repository token「ItemModel」.*model token/,
      );
      expect(composeWithToken(OrgBusinessDataReader)).toThrow(
        /repository token「OrgBusinessDataReader」.*保留/,
      );
      expect(composeWithToken(APP_GUARD)).toThrow(
        /repository token「APP_GUARD」.*保留/,
      );
    });

    it("檢查 key 重複", () => {
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [
            tenantRegistration(),
            tenantRegistration({
              key: "items-two",
              modelName: "ItemTwo",
              collection: "items_two",
              repository: OtherItemsRepository,
            }),
          ],
        ),
      ).toThrow(/檢查 key「items\.org」重複/);
    });
  });

  describe("關聯:model / repository / check 必須在同一份登記內對得起來", () => {
    it("repository 指向同登記沒有的 model", () => {
      const registration = tenantRegistration();
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [
            {
              ...registration,
              repositories: [
                { modelName: "Missing", provider: ItemsRepository },
              ],
            },
          ],
        ),
      ).toThrow(/ItemsRepository.*model「Missing」不在登記「items」內/);
    });

    it("check 指向同登記沒有的 repository", () => {
      const registration = tenantRegistration();
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [
            {
              ...registration,
              orgDataChecks: [
                {
                  key: "items.org",
                  modelName: "Item",
                  repository: OtherItemsRepository,
                  ownerField: "orgId",
                },
              ],
            },
          ],
        ),
      ).toThrow(
        /檢查「items\.org」.*OtherItemsRepository.*不在登記「items」內/,
      );
    });

    it("check 的 model 與它指向的 repository 不是同一張(錯綁)", () => {
      const registration = tenantRegistration();
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [
            {
              ...registration,
              models: [
                ...registration.models,
                {
                  name: "Other",
                  collection: "others",
                  schema: tenantSchema("others"),
                },
              ],
              repositories: [
                ...registration.repositories,
                { modelName: "Other", provider: OtherItemsRepository },
              ],
              orgDataChecks: [
                ...registration.orgDataChecks,
                {
                  key: "others.org",
                  modelName: "Other",
                  repository: ItemsRepository,
                  ownerField: "orgId",
                },
              ],
            },
          ],
        ),
      ).toThrow(
        /檢查「others\.org」.*model「Other」.*ItemsRepository.*「Item」/,
      );
    });
  });

  describe("專案租戶 model:plugin、範圍、collection 時機與組織歸屬檢查缺一不可", () => {
    it("缺 baseFields plugin", () => {
      const schema = new Schema(
        { orgId: Schema.Types.ObjectId },
        { collection: "items" },
      );
      schema.plugin(tenantScopePlugin, { moduleData: true });
      expect(() =>
        composeDatabaseRegistrations([], [tenantRegistration({ schema })]),
      ).toThrow(/Item.*baseFieldsPlugin/);
    });

    it("缺 tenantScope plugin(光有 orgId 欄位不算)", () => {
      const schema = new Schema(
        { orgId: Schema.Types.ObjectId },
        { collection: "items" },
      );
      schema.plugin(baseFieldsPlugin);
      expect(() =>
        composeDatabaseRegistrations([], [tenantRegistration({ schema })]),
      ).toThrow(/Item.*tenantScopePlugin/);
    });

    it.each([
      ["治理類", { kind: "governance" }],
      ["以 _id 判定", { path: "_id" }],
      ["允許全域資料", { allowGlobal: true }],
    ] as const)("錯 scope:%s", (_label, options) => {
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [tenantRegistration({ schema: tenantSchema("items", options) })],
        ),
      ).toThrow(/Item.*business.*orgId.*allowGlobal: false/);
    });

    it("掛 plugin 之後才補 collection(中介層當時拿不到 collection)", () => {
      const schema = new Schema({ orgId: Schema.Types.ObjectId });
      schema.plugin(baseFieldsPlugin);
      schema.plugin(tenantScopePlugin, { moduleData: true });
      schema.set("collection", "items");
      expect(() =>
        composeDatabaseRegistrations([], [tenantRegistration({ schema })]),
      ).toThrow(/Item.*掛 tenantScopePlugin 之前/);
    });

    describe("schema 必須真的宣告必填的 ObjectId orgId(plugin 不會替它補欄位)", () => {
      /** plugin、範圍、collection、repository、check 全都合規,只有 orgId 的宣告不同。 */
      function schemaWithOrgId(orgId?: unknown): Schema {
        // autoIndex / autoCreate 關掉:下面會在沒有連線的情況下編譯 model,不讓它排隊等資料庫
        const schema = new Schema(
          { name: String },
          { collection: "items", autoIndex: false, autoCreate: false },
        );
        if (orgId !== undefined) {
          schema.add({ orgId } as SchemaDefinition);
        }
        schema.plugin(baseFieldsPlugin);
        schema.plugin(tenantScopePlugin, { moduleData: true });
        return schema;
      }

      it("沒宣告 orgId:拒絕 —— 否則 strict 模式存檔時會把 orgId 丟掉,資料沒有歸屬", async () => {
        const schema = schemaWithOrgId();
        // 先證明洞是真的:給了 orgId 也留不住,而且驗證照樣通過
        const Item = model("OrgIdlessItem", schema, undefined, {
          overwriteModels: true,
        });
        const document = new Item({
          orgId: new Types.ObjectId(),
          name: "x",
          moduleKey: "items",
        });
        expect(document.toObject()).not.toHaveProperty("orgId");
        await expect(document.validate()).resolves.toBeUndefined();

        expect(() =>
          composeDatabaseRegistrations([], [tenantRegistration({ schema })]),
        ).toThrow(/Item.*沒有宣告 orgId 欄位/);
      });

      it.each([
        [
          "字串",
          { type: String, required: true },
          /orgId 必須是 ObjectId.*String/,
        ],
        [
          "ObjectId 陣列",
          { type: [Schema.Types.ObjectId], required: true },
          /orgId 必須是 ObjectId.*Array/,
        ],
        [
          "Mixed",
          { type: Schema.Types.Mixed, required: true },
          /orgId 必須是 ObjectId/,
        ],
      ] as const)("型別錯:%s", (_label, orgId, message) => {
        expect(() =>
          composeDatabaseRegistrations(
            [],
            [tenantRegistration({ schema: schemaWithOrgId(orgId) })],
          ),
        ).toThrow(message);
      });

      it.each([
        ["沒寫 required", { type: Schema.Types.ObjectId }],
        ["required: false", { type: Schema.Types.ObjectId, required: false }],
        [
          "有條件必填(函式)",
          { type: Schema.Types.ObjectId, required: () => true },
        ],
        ["只給預設值", { type: Schema.Types.ObjectId, default: null }],
      ] as const)("非必填:%s", (_label, orgId) => {
        expect(() =>
          composeDatabaseRegistrations(
            [],
            [tenantRegistration({ schema: schemaWithOrgId(orgId) })],
          ),
        ).toThrow(/Item.*orgId 必須無條件必填/);
      });

      it.each([
        [
          "包在 [函式, 訊息] 裡",
          {
            type: Schema.Types.ObjectId,
            required: [() => false, "orgId 必填"],
          },
        ],
        [
          "包在 { isRequired: 函式 } 裡",
          {
            type: Schema.Types.ObjectId,
            required: { isRequired: () => false, message: "orgId 必填" },
          },
        ],
      ])(
        "有條件必填(%s):isRequired 是 true、沒有 orgId 的文件卻驗得過 → 拒絕",
        async (label, orgId) => {
          const schema = schemaWithOrgId(orgId);
          // 先證明洞是真的:Mongoose 把它標成必填,但條件回 false 時缺 orgId 照樣通過驗證
          expect(schema.path("orgId").isRequired).toBe(true);
          const Item = model(
            `ConditionalOrgIdItem ${label}`,
            schema,
            undefined,
            {
              overwriteModels: true,
            },
          );
          const document = new Item({ name: "x", moduleKey: "items" });
          await expect(document.validate()).resolves.toBeUndefined();
          expect(document.get("orgId")).toBeUndefined();

          expect(() =>
            composeDatabaseRegistrations([], [tenantRegistration({ schema })]),
          ).toThrow(/Item.*orgId 必須無條件必填/);
        },
      );

      it.each([
        [
          "{ isRequired: true, message }",
          {
            type: Schema.Types.ObjectId,
            required: { isRequired: true, message: "orgId 必填" },
          },
        ],
        ["required: true", { type: Schema.Types.ObjectId, required: true }],
        [
          "帶訊息的 required",
          { type: Schema.Types.ObjectId, required: [true, "orgId 必填"] },
        ],
      ] as const)("合規:%s", (_label, orgId) => {
        expect(() =>
          composeDatabaseRegistrations(
            [],
            [tenantRegistration({ schema: schemaWithOrgId(orgId) })],
          ),
        ).not.toThrow();
      });

      it("@Prop({ type: Types.ObjectId })(bson class)實際產出 Mixed:拒絕並指出正確寫法", () => {
        @NestSchema({ collection: "items" })
        class BsonTyped {
          @Prop({ type: Types.ObjectId, required: true })
          orgId!: Types.ObjectId;
        }
        const schema = SchemaFactory.createForClass(BsonTyped);
        schema.plugin(baseFieldsPlugin);
        schema.plugin(tenantScopePlugin, { moduleData: true });
        expect(schema.path("orgId").instance).toBe("Mixed");

        expect(() =>
          composeDatabaseRegistrations([], [tenantRegistration({ schema })]),
        ).toThrow(
          /orgId 必須是 ObjectId,現在是 Mixed.*Schema\.Types\.ObjectId/,
        );
      });

      it("欄位形狀不取代 plugin 證據:orgId 宣告得再對,沒掛 plugin 照樣拒絕", () => {
        const schema = new Schema(
          { orgId: { type: Schema.Types.ObjectId, required: true } },
          { collection: "items" },
        );
        expect(() =>
          composeDatabaseRegistrations([], [tenantRegistration({ schema })]),
        ).toThrow(/Item.*baseFieldsPlugin/);
      });
    });

    it("漏了組織歸屬檢查", () => {
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [{ ...tenantRegistration(), orgDataChecks: [] }],
        ),
      ).toThrow(/Item.*沒有組織歸屬檢查/);
    });

    it("專案檢查的歸屬欄固定 orgId", () => {
      const registration = tenantRegistration();
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [
            {
              ...registration,
              orgDataChecks: registration.orgDataChecks.map((check) => ({
                ...check,
                ownerField: "ownerOrgId" as const,
              })),
            },
          ],
        ),
      ).toThrow(/檢查「items\.org」.*歸屬欄固定為 orgId/);
    });

    it("底座登記不受這些要求約束(全域表、專用歸屬欄照舊)", () => {
      expect(() =>
        composeDatabaseRegistrations([baseRegistration()], []),
      ).not.toThrow();
    });
  });

  describe("既有例外:只認固定入口精確列出的那一組", () => {
    class LegacyRepository {}
    const LEGACY: LegacyUnscopedModel = {
      modelName: "Legacy",
      collection: "legacies",
      repository: LegacyRepository,
    };

    /** 沒有租戶 plugin、沒有 BaseRepository、沒有檢查的舊原型。 */
    function legacyRegistration(
      overrides: Partial<{
        modelName: string;
        collection: string;
        provider: Provider;
      }> = {},
    ): DatabaseRegistration {
      const modelName = overrides.modelName ?? "Legacy";
      return {
        key: "legacy",
        models: [
          {
            name: modelName,
            collection: overrides.collection ?? "legacies",
            schema: new Schema({ title: String }),
          },
        ],
        repositories: [
          { modelName, provider: overrides.provider ?? LegacyRepository },
        ],
        orgDataChecks: [],
      };
    }

    it("model、collection、repository token 全中:豁免租戶要求,仍參與碰撞驗證", () => {
      const composed = composeDatabaseRegistrations(
        [],
        [legacyRegistration()],
        [LEGACY],
      );
      expect(composed.exports).toEqual([LegacyRepository]);
      // 例外不經 BaseRepository,不列入啟動時的識別驗證
      expect(composed.projectRepositories).toEqual([]);

      expect(() =>
        composeDatabaseRegistrations(
          [baseRegistration("base", "Setting", "legacies")],
          [legacyRegistration()],
          [LEGACY],
        ),
      ).toThrow(/collection「legacies」重複/);
    });

    it("沒有列在例外裡:一樣要求租戶 plugin", () => {
      expect(() =>
        composeDatabaseRegistrations([], [legacyRegistration()]),
      ).toThrow(/Legacy.*baseFieldsPlugin/);
    });

    it.each([
      ["model 名不同", { modelName: "LegacyTwo" }],
      ["collection 不同", { collection: "legacy_items" }],
      ["repository token 不同", { provider: class AnotherRepository {} }],
    ] as const)("只差一項就不算例外:%s", (_label, overrides) => {
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [legacyRegistration(overrides)],
          [LEGACY],
        ),
      ).toThrow(/baseFieldsPlugin/);
    });

    it("例外的 model 多掛一個非專用 repository 也不算", () => {
      const registration = legacyRegistration();
      expect(() =>
        composeDatabaseRegistrations(
          [],
          [
            {
              ...registration,
              repositories: [
                ...registration.repositories,
                { modelName: "Legacy", provider: class ExtraRepository {} },
              ],
            },
          ],
          [LEGACY],
        ),
      ).toThrow(/baseFieldsPlugin/);
    });
  });
});
