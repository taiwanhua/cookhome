# 資料模型地圖(專案)

本專案自己的 collection。格式與跨檔約定照底座 [docs/data-model.md](../data-model.md);欄位、型別、索引的正本在程式碼 `apps/api/src/project/database/`(schema 與 repository,登記在 `registrations.ts`)。本檔只寫現況:表建立時才列。

## 專案資料

| collection | 用途                          | 資料與存取正本                                                                                                            |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `recipes`  | 食譜原型,供前台公開查詢與建立 | `apps/api/src/project/database/recipe.schema.ts`、`recipes-legacy.repository.ts`;API 位於 `apps/api/src/project/recipes/` |

## 食譜原型的資料層例外

`recipes` 是沒有租戶欄位的早期原型:沒有 `orgId`,僅有 Mongoose timestamps,未掛 `baseFieldsPlugin` / `tenantScopePlugin`,不經 BaseRepository,由專用 repository `RecipesLegacyRepository` 存取。前台的公開查詢與建立介面保留現行行為:`recipes.resolver.ts` 整個標 `@Public()`(front 建置時預渲染也會打)。

- **登記**:固定入口 `apps/api/src/database/database.module.ts` 的 `LEGACY_UNSCOPED_MODELS` 精確鎖定 Recipe model、`recipes` collection 與專用 repository token(底座允許的唯一寫法,見[資料層組裝](../concepts/data-layer-and-isolation.md#底座與專案資料的組裝))。它仍參與名稱碰撞檢查,只豁免租戶 plugin、BaseRepository 與組織歸屬檢查;專案登記沒有略過檢查的旗標。
- **清空租戶**:`project/database/tenant-purge.ts` 登記為 `keep`(不屬任何租戶)。
- **base-sync verify**:`database.module.ts` 因這筆例外與底座不同,每次升級固定列在 verify 第 1 節,升級 PR 逐次說明。
- **不是範本**:新增專案租戶資料一律照底座契約(BaseRepository、baseFields、tenantScope、組織歸屬檢查),不得照抄此例外;要新增例外只能改固定入口並經 review。
