# 功能登記與客製替換規格

本規格定義[底座同步計畫](base-sync.md)工作包 B 的實作契約。目標是把底座與專案的功能來源分開,由固定入口組裝;專案可以新增功能與另存客製頁,底座更新時仍保有自己的原版。這是待實作規格,實際進度與驗證以 issue/PR 為準。

本包保留現有網址、授權、資料隔離與 GraphQL 契約。不改 seed/migration 所有權,不建立底座 repo、初始化 skill 或跨 repo 更新工具;這些依共同計畫另行交付。登記功能不代表替使用者授權。

## 接手與寫入分工

先讀 `CLAUDE.md`、[文件入口](../README.md)、[協作規則](../agents/collaboration.md)、本文件與負責的 issue,再讀對應規範與模組文件。實作與測試由 Claude 負責,主流程整理規格、審查及 issue/PR/release;共同文件足以供其他人或只有 Claude 時接手。

| 票的範圍     | 唯一寫入範圍                                                         | 驗收責任                                               |
| ------------ | -------------------------------------------------------------------- | ------------------------------------------------------ |
| 規格         | 本文件、共同計畫及 README 指路                                       | 接縫、所有權、負例及下游檔案歸屬明確                   |
| 後台登記     | `apps/admin/**`、`packages/config-eslint/frontend-style.js` 及其測試 | 頁面搬移、新增/替換、表單設定、help、分層與真 build    |
| API 登記     | `apps/api/**`;GraphQL 產物只允許重產驗證,契約應不變                  | 功能/資料登記、組織資料檢查、Recipes 搬移、真 API 驗收 |
| GraphQL 文件 | `packages/graphql/**`、CI 的文件登記驗證步驟                         | 文件分區、重名拒絕、共用產物與既有呼叫相容             |
| 維護指引     | `CLAUDE.md`、`AGENTS.md`、`CONTEXT.md`、`docs/**` 的相關指路與規則   | 依最終程式更新正本、盤點及新增模組流程                 |

每票一個工作樹與 owner。三張程式票從規格基線各自分支;API 票若重產造成公開契約或 generated diff,先回報而不寫入 GraphQL owner 的檔案。維護指引最後依三票成果整合,避免把待實作設計寫成現況。程式票不可改 `CLAUDE.md`、`AGENTS.md` 或規則本文;help 內容及必要 import 路徑歸後台票。任何檔案超過 `max-lines` 時拆實作檔,不擴大 lint 豁免。

## 所有權與固定入口

| 類型               | 底座來源                                                 | 專案來源                                                                            | 固定組裝入口                                     |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| 後台頁面           | `apps/admin/src/pages/base/`、`app/base/module-pages.ts` | `pages/project/`、`app/project/module-pages.ts`、`app/project/page-replacements.ts` | `app/module-pages.tsx`                           |
| 後台說明           | `apps/admin/src/md/module-help/base/`                    | `md/module-help/project/additions/`、`project/replacements/`                        | `lib/help-registry.ts`                           |
| API 功能           | 既有核心功能目錄、`src/base/api-modules.ts`              | `src/project/project.module.ts`、`project/api-modules.ts`、`project/<業務>/`        | `src/app.module.ts`                              |
| API 資料           | `src/database/`、`database/base/registrations.ts`        | `src/project/database/`、`project/database/registrations.ts`                        | `database/database.module.ts`                    |
| GraphQL operations | `packages/graphql/src/documents/base/`                   | `packages/graphql/src/documents/project/`                                           | `packages/graphql/codegen.ts` 與 generate script |

admin 保留 `app → pages → components → hooks/stores → lib` 分層。現有 pages 全搬到 `pages/base/`,其內部路徑維持;示範共用 CRUD 元件由 `pages/demo/shared/` 提升到 `components/base/crud/`,避免專案頁引用底座頁內部。元件既有名稱先保留,不混入改名。其他層既有共用內容仍由底座維護,專案內容放該層 `project/`;不改成頂層 `src/project/` 繞過分層。前台業務畫面維持由專案設計,本包不搬前台版面。

底座檔不可反向 import 專案來源;只開放表中固定組裝入口。admin 的 `src/test/**` 可豁免新增的所有權限制,既有分層與循環依賴檢查仍適用;不放寬整個 app 層。專案頁不可 import 底座頁內部,共用能力經 components/hooks/lib 使用。所有權檢查必須保留現有分層與循環依賴檢查,不能以新的 ESLint 設定蓋掉舊 zones。

## 後台頁面契約

型別與純合成放 `app/module-page-registry.ts`,頁面仍使用既有 `lib/module-tree.ts` 的 `ModulePageProps`。必要時將型別拆至同層 `module-page-types.ts`,不讓低層 import app。

```ts
type PageComponent = ComponentType<ModulePageProps>;
type FormPageSlot = "list" | "viewPage" | "createPage" | "editPage";
interface PagePresentation {
  readonly Page: PageComponent;
  readonly minWidth?: ShellMinWidth;
}
interface ModulePageEntry extends PagePresentation {
  readonly key: string;
}
interface FormPageEntry {
  readonly moduleKey: string;
  readonly options?: FormModuleOptions;
  readonly pageOverrides?: Readonly<Partial<Record<FormPageSlot, PagePresentation>>>;
}
interface ModulePageSource {
  readonly pages: readonly ModulePageEntry[];
  readonly forms: readonly FormPageEntry[];
}
interface ModulePageReplacement extends PagePresentation {
  readonly target: string;
}
composeModulePages(input: {
  readonly base: ModulePageSource;
  readonly project: ModulePageSource;
  readonly replacements: readonly ModulePageReplacement[];
}): {
  readonly pages: ModulePageRegistry;
  readonly pageMinWidths: Readonly<Record<string, ShellMinWidth>>;
  readonly formModuleOptions: FormModuleOptionsRegistry;
};
```

輸入必須保留 entry 序列,先展開表單四頁,再驗證所有 key。拒絕空 key、同來源重複、base/project 撞 key、表單展開與固定頁碰撞。錯誤列出 key 與來源;不能先 spread 成物件才驗證,因為那時已丟失被覆蓋項。輸出查詢只認 own key,不受物件原型同名成員影響。

替換只准指定已存在的底座頁;未知目標、同目標兩次替換均拒絕。省略 `minWidth` 繼承底座,明寫才改寬度。底座原檔及登記保留,移除替換即恢復原版;不另開繞過既有授權的原版路由。專案自有表單的單頁客製用 `pageOverrides`,不以撞 key 表達。

網址、模組名、permissions 與 engine 仍取 `me.modules`;頁面登記不得另定這些值。公開登入線不新增替換介面。`RequireAuth`、`ModuleRoute`、隱藏頁參數與路由頁籤的守門保留。既有 Forms/Workflows 的 `xl` 及其他頁預設 `lg` 保留。

### 表單設定不能在載入時寫全域 Map

`formModulePages(moduleKey)` 改為只回傳既有四頁,保留 lazy 元件身分與懶載入;刪除 `registerFormModule` 的全域可變狀態。`ModulePageSource.forms` 同時提供四頁與 options,不維護第二份 key 清單。`pageOverrides` 在展開時套用;替換底座表單頁不改其 options。

純型別與 `composeFormModuleOptions(entries)` 放 `lib/form-engine/form-module-options.ts`。entry 為 `{ moduleKey, options? }`,輸出 `ReadonlyMap<string, Readonly<Required<FormModuleOptions>>>`;同 key 拒絕,未給模板沿用既有預設。函式不修改輸入。

新增 `components/form-engine/FormModuleOptionsProvider/` 的 Provider、context、hook,分檔遵守元件規範。`useFormModuleOptions(moduleKey)` 有 Provider 但無該 key 時回預設,缺 Provider 則明確拋接線錯誤。`useTabLabelRenderer` 透過 hook 讀設定,components 不 import app。

新增 `app/providers/RootProviders.tsx`,讀取固定組裝結果,以既有 `AppProviders` 包住表單設定 Provider。`App.tsx` 與 `test/test-app.tsx` 共用它;一般表單元件測試顯式供給 Provider。底座表單模板與表單自身模板的優先序、申請中心詳情與頁籤標題行為不變。

## Help 合成與產物

現有 help 搬到 `md/module-help/base/`,檔名與內文不改。專案新增與替換使用不同子目錄,各以 `<moduleKey>.help.md` 為 key。`lib/help-registry.ts` 是唯一 Vite glob 入口,以三份 `eager: true`、`?raw` glob 讀取來源,並保留 `moduleHelpMarkdown(module)` 對外介面;`lib/module-help.ts` 只放純合成與查詢函式。

純 `composeHelpRegistry({ base, additions, replacements })` 接收三份「完整檔案路徑 → Markdown」,回傳 readonly map。驗證同來源 key 重複、新增與底座碰撞、替換不存在的底座 help、重複替換與空白替換。替換頁未提供 help 時仍取原說明。查詢順序仍為專屬說明 → 表單通用 `form-module` → undefined;非模組路由及無內容按鈕狀態不變。

`test/help-registry.ts` 保留現有 set/reset 介面並支援三來源,`scripts/check-help-bundle.mjs` 掃描三區。保留 `.md` 錯命名檢查、必備底座通用檔與 Dockerfile 建置後檢查;專案目錄可空。真 bundle 中有文字只是收檔證據,仍須以實際 HelpButton 測試證明選到替換內容。

## API 與資料登記契約

AppModule 保留 Config、GraphQL、Mongoose connection 與全部現有 guards 的接線。底座功能清單與專案清單都採 `ApiFeatureRegistration { readonly key: string; readonly module: Type<unknown> }`。`ProjectModule` 為普通 Nest module,讀 `project/api-modules.ts`;固定入口驗證兩份清單的 key 及 module identity 唯一。只新增專案功能,不提供核心 module/provider 替換介面。

資料登記型別及 `composeDatabaseRegistrations(base, project)` 放 `database/registration.ts`,驗證可拆到 `database/registration-validation.ts`。最低契約:

```ts
interface DatabaseRegistration {
  readonly key: string;
  readonly models: readonly {
    name: string;
    collection: string;
    schema: Schema;
  }[];
  readonly repositories: readonly {
    modelName: string;
    provider: Provider;
  }[];
  readonly orgDataChecks: readonly {
    key: string;
    modelName: string;
    repository: InjectionToken<OrgOwnedDataRepository>;
    ownerField: "orgId" | "ownerOrgId";
  }[];
}
interface OrgOwnedDataRepository {
  existsAny(
    operator: OperatorContext,
    ownerField: "orgId" | "ownerOrgId",
    orgId: Types.ObjectId,
  ): Promise<boolean>;
}
```

DI token 就是 repository 身分,不另造 repository key。所有 repository providers、exports 由登記導出;model provider 不對業務模組匯出,也不 export 整個 MongooseModule。先將現有 inline repository classes/types 搬到 `database/base/repositories.ts` 等 leaf 檔,再組裝登記;`database.module.ts` 保留既有 repository re-export 相容出口,leaf 不回指組裝入口。現有專用資料層介面、factory providers 及 DataScopeRuleProvider 啟動檢查都保留。

組裝前拒絕登記 key、model name、實際 collection、repository token、檢查 key 重複;token 依 class/string/symbol 本體比較,不用 class.name。拒絕 repository token 撞 model token、組裝器內部 token 或 Nest 全域 guard/interceptor/filter/pipe token。repository 的 modelName 必須存在於同一登記;check 必須指向同登記的 repository 且 modelName 一致。多個 repository 可共用同一 model,保留既有 adapters。collection 必須與 schema 選項一致,原 schema instance/plugin 保留,不 clone 或補掛第二次。

一般新增專案 model 每個都必須有組織歸屬檢查。BaseRepository 增加只讀 modelName/collection 識別 getter,不暴露 Model;reader 的 DI factory 檢查專案 check 的 repository 確為 BaseRepository 且實際識別吻合,錯綁另一張表即失敗。底座專用 adapters 保持現有型別與行為。

新增專案租戶資料沿用示範模組形狀:BaseRepository、baseFields、tenantScope 的 business scope、`orgId`、`allowGlobal: false`;模組資料使用 `moduleData: true`,專案 check 的 ownerField 固定 `orgId`。掛 plugin 前即設定 collection。baseFields 增加 WeakSet marker/getter,安裝完成才記錄;tenantScope 沿用 getTenantScope 並記錄安裝時的 collection 供驗證。缺 plugin、錯 scope、事後才補 collection、漏 check、錯綁 repository 都拒絕;不讀 Mongoose 私有 metadata,不把欄位存在當成 middleware 證據。

不得讓專案 callback 取得繞過隔離的 operator。API lint 擋底座反向引用 project,只允許 AppModule、DatabaseModule 組裝入口;限制業務服務自行使用 Mongoose 注入/註冊工具,並保持 no-raw-model-query 覆蓋專案資料層。測試 fixture 只豁免新增的所有權方向限制,不豁免 raw query 規則。

此接縫是受審查程式的組裝契約,不是執行不受信任外掛的沙盒。不遞迴稽核任意 Nest metadata,不新增服務發現、多連線或 runtime override framework。未登記的私自註冊不能宣稱受碰撞驗證保護,由來源限制與 review 擋下。

### 刪組織與撤銷開通共用資料檢查

新增底座 `database/org-business-data.reader.ts` 的 `OrgBusinessDataReader.hasBusinessData(operator, orgId): Promise<boolean>`。OrgsService 的刪除組織與 revokeProvision 共用它,其他資格判斷保持原樣。

七個既有 BaseRepository 存在檢查改從底座登記取得;workflows/tasks 的 tenantId 專用檢查保留底座 adapter。一般新增專案租戶 model 必須提供組織歸屬檢查,既有 Recipe 依下一節唯一例外。檢查固定使用 repository、歸屬欄與已驗證 orgId,不接受自訂 callback/filter。查詢錯誤必須使刪除失敗,不可當成沒有資料。audit logs 保持不阻擋。`existsAny` 的受控 caller 從 OrgsService 轉為此 reader,既有 caller 測試也轉移,不能把 project 目錄列為例外。

### Recipes 的既有相容邊界

`src/recipes/` 搬至 `src/project/recipes/`;schema 及三個 raw model 操作移到 `project/database/` 的 Recipes 專用 repository,由資料登記集中註冊並只 export repository。保留 `@Public`、既有 GraphQL 契約、`recipes` collection 與無 orgId 的原型行為。現有 raw query waiver 只搬到此專用 adapter,不新增通用 unsafe 開關。新專案租戶模組不可照抄此例外。

此例外由固定 DatabaseModule 組裝入口維護,精確鎖定 Recipe model、recipes collection 與專用 repository token。它仍參與所有碰撞驗證,只豁免租戶 plugin/BaseRepository/org check 要求。project entry 沒有 unsafe/global/略過檢查旗標;不自動接受新增例外。

## GraphQL 文件與唯一產物

`recipes.graphql` 搬到 `src/documents/project/`,其餘既有 documents 搬到 `src/documents/base/`;codegen 既有遞迴 glob 可涵蓋兩者。generated 仍只有一份,front/admin 繼續 import `@repo/graphql`,不建立兩份 hooks 或讓專案覆寫底座 operation。

新增 `scripts/check-documents.mjs` 與 Node test:用既有 graphql parser 逐檔驗證命名 operation/fragment 全域唯一,相同內容同名也拒絕,錯誤包含兩個來源路徑。底座與專案同一套規則,不以檔案順序決定勝者。拒絕來源根目錄散落文件及匿名 operation;支援子目錄,檔名不作 operation 的身分。`generate` 寫產物之前先跑此檢查,CI 的 codegen 流程同步跑負例測試。

保留「真 AppModule 產 schema → codegen」單一路徑;此次重產不得改變公開 schema、generated 型別與 hooks 的契約。若搬目錄只造成 generated 區塊順序變動,由 GraphQL 票附匯出與 operation 一致的證據,不手改產物。GraphQL 型別與 resolver 欄位碰撞另由真 schema 建置及 API 測試驗證,feature key 唯一不代表 schema 名稱安全。

## 驗收

| 範圍         | 現況                                 | 期望                                                                                                                                                             |
| ------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 正式頁面來源 | 單份物件登記,spread 可蓋掉先前項     | CI 載入真登記表;新增/替換明確,碰撞與未知替換失敗,原版可恢復                                                                                                      |
| 專案畫面     | 需改共用登記                         | 獨立測試專案只替換 project 來源,經真正組裝入口新增頁與替換治理頁;正式 project 清單仍空                                                                           |
| 路由/頁籤    | ModuleRoute 依 me.modules 守門       | 同網址開客製版;撤除授權不可 render 或留下頁籤;預設導向、隱藏頁參數、寬度與詳情標題保留                                                                           |
| 表單 options | 載入即改共享 Map                     | 不同組裝互不污染;四頁、lazy、模板優先序、申請中心與重新整理行為保留                                                                                              |
| Help         | 單層 glob/checker                    | 新增與替換正確呈現;同 key/未知/空替換拒絕;三來源真 Vite build 與 bundle check 通過                                                                               |
| API 新模組   | 多處硬接線                           | 測試只替換兩份 project 登記來源,由真 AppModule/DatabaseModule 啟動專案 fixture;不 mock reader/guards/repository                                                  |
| 專案資料     | 新表易漏刪除檢查                     | fixture 真 GraphQL/Mongo 驗未登入/未授權、租戶隔離、缺 operator、軟刪除、資料範圍;資料被範圍隱藏仍阻止刪組織及 revokeProvision,其他組織資料不誤擋,檢查錯誤不放行 |
| API 碰撞     | Nest/Mongoose 可能重用同 token/model | 對 key/model/collection/provider/check 的負例啟動失敗;保留既有資料層安全測試                                                                                     |
| GraphQL      | 文件同目錄                           | 兩來源重名必敗、專案新文件可產 hook;正式 schema、generated 型別及 operation 契約與基線相等                                                                       |
| 所有權       | 依口頭約定                           | 真 ESLint 驗底座→專案拒絕、專案→共用允許、固定入口允許、components→pages 仍拒絕                                                                                  |

測試專案資料與授權只由隔離 harness 建立,不改正式 seed、不把 fixture 送入 production。既有測試、各包直接 lint/typecheck、格式與真建置依 toolbox 執行。admin 以 mock 模式留代表性治理/表單/CRUD/help 畫面證據;fixture 另證明客製與新增。E2E 依 issue tracker 由使用者決定觸發,票面只提供劇本建議。

部署前核對實際環境版本與待 migration,列出累積差異。完成本包不代表跨 repo 升級演練已完成;其後仍需 seed 所有權、初始化與正式版本同步工作包。
