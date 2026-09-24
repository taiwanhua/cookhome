# 指路清單

只列路徑與編號,不抄內容。打開前以 repo 當下的檔為準;路徑對不上時照實際檔案做,並在 PR 的「接手體驗」回報。

## 步驟正本

- `docs/agents/module-scaffold.md`:檔案清單、步驟 0–8、選配對照表、交件前檢查清單
- `docs/agents/issue-tracker.md`:「實作一張票」、「交件報告格式」、「admin 票的交付要求」、「拆票與寫票的規則」
- `docs/agents/toolbox.md`:指令;`docs/agents/pitfalls.md`:症狀 → 做法

## 藍本:示範模組 2(最小)

- 模組文件:`docs/modules/demo.sample-two.md`(章節骨架照抄這份)
- seed:`apps/db-migrator/seeds/modules/demo.sample-two.ts`
- schema:`apps/api/src/database/schemas/demo-item-two.schema.ts`
- api:`apps/api/src/demo-items-two/`
- documents:`packages/graphql/src/documents/demo-items-two.graphql`
- admin:`apps/admin/src/pages/demo/demo-sample-two-config.ts`、`demo-sample-two-types.ts`、`SampleTwoModule.tsx`、`SampleTwoPage/`
- help:`apps/admin/src/md/module-help/demo.sample-two.help.md`
- MSW:`apps/admin/src/test/msw/demo-sample-two-handlers.ts`、`demo-two-fixtures.ts`

## 藍本:示範模組 1(選配全開)

- 模組文件:`docs/modules/demo.sub.sample-one.md`
- seed:`apps/db-migrator/seeds/modules/demo.sub.sample-one.ts`(含 `dataScopeTarget`、群組節點宣告)
- api:`apps/api/src/demo-items-one/`(欄位級權限:`demo-items-one.service.ts`、`demo-item-one-mapper.ts`)
- admin:`apps/admin/src/pages/demo/SampleOneModule.tsx`、`demo-sample-one-config.ts`
- MSW:`apps/admin/src/test/msw/demo-sample-one-handlers.ts`

## 共用接縫

- 前端設定型別:`apps/admin/src/pages/demo/shared/demo-module-config.ts`(`DemoModuleConfig`,逐項 JSDoc 即規格)
- 選配 hook 的替身:`apps/admin/src/pages/demo/shared/useDemoQuery.ts`(`noDemoSetEnabled`)
- 頁面登記:`apps/admin/src/app/module-pages.tsx`
- 佔位夾具(不要登記):`apps/admin/src/test/msw/module-fixtures.ts` 的 `placeholderModules`
- seed 宣告型別:`apps/db-migrator/seeds/module-declaration.ts`;註冊:`apps/db-migrator/seeds/modules.ts`;示範資料註冊:`apps/db-migrator/seeds/registry.ts`
- 租戶管理員模板的推導:`apps/db-migrator/seeds/role-bindings.ts`
- 圖示白名單:`packages/domain/src/module-icon/keys.ts`;語意對照 `docs/modules/module-manager.md`「側欄圖示」
- 上傳規則:`apps/api/src/storage/upload-rules.ts`
- key 規約測試:`apps/db-migrator/src/seed/seed-key-convention.test.ts`

## 規則(問答時要引用的)

- ADR:0002 seed、0004 權限模型、0005 租戶隔離、0007 基礎欄位、0008 資料範圍、0009 開通與模板、0010 檔案儲存、0011 權限判斷流程、0012 前端分層(`docs/adr/`)
- 規範索引:`docs/standards/README.md`;常用編號 GQL-02 / 03 / 04 / 05 / 06 / 07、STRUCT-01 / 03、I18N-02、REACT-06、TEST-07 / 08、FIGMA-04
- 詞彙:`CONTEXT.md`(「隱藏頁」「權限容器」等)
- 劇本:`docs/testing/permission-scenarios.md`
