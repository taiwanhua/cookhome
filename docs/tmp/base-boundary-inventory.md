# 底座維護邊界盤點

本表列出底座與專案的維護歸屬及固定組裝入口。專案設定由獨立值檔提供,功能來源依 base/project 分區;底座更新組裝契約,專案在自己的來源新增或登記客製替換,避免日常擴充反覆修改底座清單。

A 的設定與部署識別已交付;下列 B 路徑依[功能登記與客製替換規格](../plans/feature-registration.md)整理維護現況,整合驗收與發布狀態以 issue/PR 為準。C–F 尚待實作,特別是 seed/migration 來源尚未分區。完整決策與工作包見[底座同步計畫](../plans/base-sync.md),逐檔初始化與 seed 欄位見[初始化盤點](project-bootstrap-inventory.md)。此盤點不執行資料庫、雲端或正式 Figma 操作,也不代表底座 repo 或跨 repo 同步已建立。

## 已確認的原則

- 根組織名稱與描述均屬專案初始值:建立新專案時先重新指定該專案的 seed;一般部署/升級重跑 seed 保留 UI 已修改的初始值欄位。明確清庫並強制完整還原時,清除修改並以該專案的 seed 重建,不是回到底座品牌。此要求不代表所有系統定義都停止同步,欄位仍須分類。

- 新增權限採 A:維持既有同層 wildcard 語意,持有模組 `*` 的角色涵蓋該模組新增動作;只持有個別權限者不自動取得新增動作。全新模組另行授權。升級報告須列出受影響角色與新增能力。

- 示範程式與藍本由底座維護,專案業務另建模組。正式環境也允許灌入示範資料;保留示範模組初建 `enabled=true` 的現行行為,開關模組與租戶分配由人員手動維護。初始化不強制停用、排除模板或自動撤銷分配;一般升級須保留人員已調整的啟用狀態。

- 刪除 seed 授權宣告維持現行行為:只停止補建該關聯,不自動刪除資料庫既有授權。實際撤銷由人員管理操作或另行明確授權的資料遷移處理。

- 前台畫面、版型與風格由專案客製;底座保留完整 front app 骨架與共用能力。專案依需要選擇共用 UI,不要求前台自動接入 `AppThemeProvider` 或跟隨後台主題。

- 表單引擎、審核流程與申請中心全部列為底座標準能力,底座維護引擎與預設畫面;各專案/租戶維護自己的表單、流程定義與業務資料。

- 底座與引用專案各自獨立 repo,建立專案時保留共同 Git 歷史;每個專案固定帶 front、admin、api。
- 底座內容與專案內容從起點就分資料夾存放,各自維護登記清單,由固定組裝入口讀取。專案新增與客製替換分開登記,底座原版保留。A/B 的路徑與契約已有正本;seed/migration 的來源分工屬 C。
- 權限與租戶隔離等核心由底座維護;專案透過設定與擴充滿足需求。治理頁允許另存客製版,保留底座原版與受保護介面。
- 以正式版本同步,優先讓專案持續升級;舊版修補只作例外。agent 準備升級 PR,由使用者審查合併與發布。
- 初始化與升級分開,升級保留專案設定及既有資料;Figma 接受 Library 更新後的品牌補套與檢查也屬同步範圍。
- 共用名詞進 `CONTEXT.md`;初始化需另作完整盤點再製作 skill。所有新專案需分別設定的項目都納入,包含品牌、雲端資源、開發工具、資料庫、外部服務與環境;skill 引導使用者提供必要輸入,分別記錄已提供、已建立與已驗證狀態。完整決策見 [底座同步計畫](../plans/base-sync.md)。

## 維護歸屬

下表路徑相對 repo 根目錄。「底座維護」指向上回收、由正式版本分發,不表示禁止專案提出修改。「專案擴充」仍須遵守底座介面與權限規則。

| 項目               | 現況位置與證據                                                                                                                                                        | 維護歸屬與擴充方式                                                                                                     | 升級方式與驗收                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 權限解析與資料隔離 | `apps/api/src/permission/`、`database/base.repository.ts`、`database/plugins/tenant-scope.plugin.ts`、`data-scope/`;共用 key 規則在 `packages/domain/src/permission/` | 底座維護;專案宣告自己的權限與資料範圍,不替換解析及隔離規則                                                             | 合併底座修正;跑核心權限及跨租戶測試,再驗專案模組                                                |
| 登入與帳號治理     | `apps/api/src/auth/`、`users/`、`orgs/`、`roles/`                                                                                                                     | 核心登入、授權、租戶開通由底座維護;品牌、網址由專案設定                                                                | 驗登入、刷新、登出、密碼流程及治理權限                                                          |
| 治理頁             | `apps/admin/src/pages/base/system/`、`app/module-pages.tsx`                                                                                                           | 原版底座維護;專案客製版另外登記替換,不得以整個 `system/` 排除更新                                                      | 同時更新原版並檢查客製版的 API、權限、欄位與互動相容性                                          |
| 後台殼與路由守門   | `apps/admin/src/app/routes.tsx`、`AdminShell/`、`guards/`                                                                                                             | 殼與守門底座維護;品牌及頁面入口可設定,較大版型差異以明確擴充點承接                                                     | 守門、側欄、頁籤與客製頁一起驗;目前 routes 仍直接引用固定登入頁                                 |
| 表單與審核引擎     | `apps/api/src/forms/`、`workflows/`;admin 的 `components/form-engine/`、表單與流程治理頁;`packages/domain/src/`                                                       | 已定案:表單引擎、審核流程與申請中心及其預設頁由底座維護;表單、流程定義和業務資料歸專案或租戶                           | 引擎升級驗既有版本、提交、修訂、審核實例及客製組裝;不把執行期表單當共用 seed 覆寫               |
| 稽核、儲存與寄信   | `apps/api/src/audit/`、`storage/`、`mail/`                                                                                                                            | 機制底座維護;bucket、寄件品牌與網址專案設定;特殊供應商需求先定 adapter 介面                                            | 驗既有檔案可讀、簽名、通知與稽核;保留專案資源設定                                               |
| 食譜業務           | `apps/api/src/project/recipes/`、`project/database/recipe.schema.ts`、`recipes-legacy.repository.ts`;前台 `HomeView/`;GraphQL `documents/project/recipes.graphql`     | CookHome 專屬,API 經專案登記組裝;既有公開、無 orgId 的 Recipe 是精確相容例外,不作新租戶模組藍本                        | 升級保留食譜 API、collection 與前台契約,不擴大 raw query 豁免                                   |
| 示範模組           | `apps/api/src/demo-items-one/`、`demo-items-two/`;admin 的 `pages/base/demo/`;`apps/db-migrator/seeds/demo-items.ts`                                                  | 已定案:示範程式與藍本由底座維護;專案複製成自己的模組,不直接改示範正本                                                  | 正式環境允許示範資料且保留初建啟用;開關與租戶分配由人員維護,升級保留既有啟用值                  |
| 前台畫面與風格     | `apps/front/src/app/`、`apps/front/src/components/`                                                                                                                   | 已定案:畫面、版型與風格歸專案;底座保留完整 app 骨架與共用能力                                                          | 升級共用能力保留專案設計;是否採用共用 UI 與後台主題由專案決定                                   |
| 共用 UI 與品牌     | `packages/ui/src/theme/brand.ts`、`create-theme.ts`、`brands/default.ts`;`packages/project-config/src/project/public.ts`                                              | UI、語意 tokens、色盤算法與中性橘色預設由底座維護;品牌值歸專案,AppProviders/Storybook 組裝 brand,UI 不反向依賴專案設定 | 合併 UI 後驗專案主題、亮暗模式與首幀,不把專案色盤換回預設                                       |
| 文案與多語         | `packages/i18n/`;品牌及前台 metadata 由 `project-config/public` 在應用接線時注入                                                                                      | 共用訊息與合成工具由底座維護;品牌純文字及前台業務文案歸專案                                                            | 驗 key、ICU 參數與支援語系;不能用整份專案 JSON 蓋掉新增共用 key                                 |
| API 功能與資料     | `apps/api/src/base/api-modules.ts`、`project/api-modules.ts`、`database/base/registrations.ts`、`project/database/registrations.ts`                                   | 底座維護組裝、repository 基礎與組織資料檢查;專案提供 modules、schemas、repositories 與宣告式 org checks                | 拒絕登記碰撞,新租戶 model 必有 plugin 與相符 repository/check;刪組織及撤銷開通共用檢查          |
| GraphQL            | 真 `AppModule` 產生 schema;`packages/graphql/src/documents/{base,project}/` 與 `codegen.ts`                                                                           | 底座維護生成工具,兩份文件來源組成一份 generated;前台/後台仍 import `@repo/graphql`                                     | operation 與 fragment 各自在所有來源唯一,拒絕匿名、根目錄散檔與 symlink;重產驗契約,不手改生成碼 |
| 模組與 seed        | `apps/db-migrator/seeds/modules.ts`、`registry.ts` 集中登記;`src/seed/` 有欄位保護                                                                                    | runner 由底座維護;底座/專案宣告與 key、欄位所有權分工仍待 C 設計                                                       | 後續驗重複 key、父子依賴、允許更新欄位及重跑冪等,保留已定案 seed 行為                           |
| migration 與 reset | `apps/db-migrator/migrations/`、`src/migration-filename.ts`、`src/reset/`                                                                                             | runner 與安全限制由底座維護;來源分區、全域識別與既有執行紀錄相容屬 C,尚未改造                                          | 在已有資料的副本驗順序及重跑;升級不得呼叫 reset,新專案 DB 命名也須通過安全檢查                  |
| 部署與環境         | `deploy/project/github.json`、`cloud.json`、`deploy/env/*.yaml`;`scripts/project-settings/` 與 workflows                                                              | 共用讀取、驗證與部署程序由底座維護;repo/看板/GCP/WIF/服務/Secret 引用及環境值歸專案                                    | 升級保留專案值;新 repo 在認證前核對 expectedRepository,不能照搬 CookHome 資源                   |
| 工具鏈與測試       | 根 `package.json`、`pnpm-lock.yaml`、`turbo.json`、`packages/config-*`、`.github/workflows/ci.yml`、`apps/e2e/`                                                       | 共用品質規則底座維護;專案依賴與測試可增加,共用設定提供明確擴充入口                                                     | 依賴宣告整合後更新 lockfile;驗底座與專案測試,不能整份選上游或本地                               |
| 文件與 skills      | `CLAUDE.md`、`CONTEXT.md`、`docs/standards/`、`docs/agents/`、`.claude/skills/module-scaffold/`                                                                       | 共用規則、術語及流程由底座維護;專案品牌、模組及操作值另存,第三方 skills 按來源版本管理                                 | 依 toolbox/協作規則核對正本及引用,不把本機 `.codex/` 或未核定副本帶進底座                       |
| Figma              | `docs/standards/general/figma.md`、`docs/branding.md` 與隔離實測紀錄                                                                                                  | 共用元件庫底座維護;專案品牌庫、業務畫面與客製內容專案維護                                                              | 接受更新後補套品牌,檢查新增圖層、變體、component key 與客製文字;新增元件亦須檢查                |

## 固定組裝入口

以下列 A/B 的固定來源與組裝責任,具體型別及負例以兩份規格為準。seed 與 Figma 另列待實作,不能套用 B 的完成聲明。既有 apps → packages 與 admin 分層不變。

| 現有集中修改點                                     | 需要的分工                                                                                                                  | 合成時必須檢查                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/admin/src/app/module-pages.tsx`              | 讀 `app/base/module-pages.ts`、`app/project/module-pages.ts` 與 `page-replacements.ts`,合成頁面、寬度與表單 options         | 先驗 entries 再建 map;新增撞 key、未知/重複替換失敗,省略替換寬度繼承原版                              |
| `apps/admin/src/lib/help-registry.ts`              | 讀底座 help、專案 additions、專案 replacements 三來源                                                                       | 新增撞 key、未知/空白/重複替換失敗;未替換的說明沿用底座                                               |
| `apps/api/src/app.module.ts`                       | 讀 `base/api-modules.ts` 與 `project/api-modules.ts`,以普通 ProjectModule 掛入專案功能                                      | feature key/module identity 唯一;核心 guard 接線保留,無核心 provider 替換介面                         |
| `apps/api/src/database/database.module.ts`         | 讀 `database/base/registrations.ts` 與 `project/database/registrations.ts`,導出 repository providers/exports 與組織資料檢查 | key/model/collection/provider/check 碰撞拒絕;原 schema/plugin 保留,不匯出 raw Model 或 MongooseModule |
| `packages/graphql/codegen.ts` 與 generate script   | 收集 `documents/base/`、`documents/project/`,讀真 AppModule 產出的 schema                                                   | 先 check-documents 再重產;一份型別/hooks,不允許文件互相覆寫                                           |
| `apps/db-migrator/seeds/modules.ts`、`registry.ts` | C 待設計:共用/專案宣告分離並驗 key、依賴與執行順序                                                                          | 需區分來源所有權,不能只依 isSystem 認養;現有行為不因 B 改動                                           |
| `packages/project-config` 與各 app 接線            | `/public` 提供品牌、slug、title/metadata 與儲存鍵;/mail 只給 API,資產仍在各 app public                                      | CookHome 歷史鍵保留;瀏覽器不可讀 mail、環境機密或 server 實作                                         |
| workflow 與 `scripts/project-settings/`            | 讀 `deploy/project/` 非機密識別與 `deploy/env/` 環境值                                                                      | 新 repo 身分先驗證,機密另由既有 Secret 機制取得                                                       |
| 共用文件與 Figma 節點表                            | E 待實作:共用規則與專案識別/節點映射分開                                                                                    | 拆檔後驗連結、元件來源與品牌綁定;file/node ID 不可直接照搬                                            |

## 目錄與來源分工

保留 apps/packages 與既有前端分層,在需要區分維護歸屬的層內分資料夾;不把 admin 的 app、pages、lib 整包移到 src/base 或 src/project 而繞過分層。下列路徑依 B 契約固定,seed 仍維持集中來源直到 C 定案。

| 範圍               | 位置與組裝方式                                                                                                                                      | 實作時一併處理                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 後台頁面           | `apps/admin/src/pages/base/`、`pages/project/`;登記在 `app/base/`、`app/project/`,由既有 `app/module-pages.tsx` 組合                                | STRUCT-03 補上所有權分區後再照路由樹排列;專案新增與替換分開,底座頁面不直接依賴專案實作                                    |
| 後台共用元件與設定 | 示範共用 CRUD 元件在 `components/base/crud/`;其他層專案內容放該層 `project/`,既有共用內容不全面搬移                                                 | 頁面登記留 app,components 不 import app/pages;表單 context/hook 在 hooks,Provider 在 app/providers                        |
| API                | 功能在 `project/<業務>/`、`project/api-modules.ts`、`project/project.module.ts`;資料在 `project/database/`,底座 repository leaf 在 `database/base/` | 新租戶 schema 保留 BaseRepository/baseFields/tenantScope,由 org checks 接入共用 reader;Recipe 專用 adapter 是唯一既有例外 |
| seed               | `apps/db-migrator/seeds/` 的 `modules.ts`、`registry.ts` 仍為正本;分來源路徑待 C 定案                                                               | 後續先合模組宣告再生成權限、資料目標及角色模板,維持順序、撞 key 檢查與欄位保護                                            |
| GraphQL 文件       | `packages/graphql/src/documents/base/`、`documents/project/`;現有 codegen 的遞迴 glob 收集兩者                                                      | `apps/api/schema.gql` 與 `src/generated/index.ts` 依整合後的來源重新產生,不保留單方舊產物                                 |

help 來源為 `md/module-help/base/`、`project/additions/`、`project/replacements/`,glob、bundle checker 與 Docker 建置檢查一併涵蓋三區。GraphQL 文件檢查的負例由專用 `test:documents` 執行,同種 operation/fragment 名稱各自全域唯一,來源樹拒絕 symlink。migration 仍是單一 migrations 目錄;C 需設計收集、執行順序、穩定識別與既有 changelog 相容性,不能只搬子目錄。多語訊息、套件宣告與 lockfile 屬整合範圍,分資料夾不代表升級時可整份忽略。

## 需要特別處理的現況

**種子資料不是全部只寫一次。** `SeedDocumentSet.initialSeedValueFields` 指定的欄位在已有值時保留;其餘宣告欄位會同步。根組織的 `name` 與 `description` 為初始值,缺少欄位才補值;API 對根描述以 null 保留明確清空意圖。新專案先指定自己的 seed 名稱與描述,完整清庫還原才回到該專案 seed 值。seed 來源分工與初始化引導屬 C/D,不與已交付的 A 設定抽離混為一談。full 模式清庫後 migrate/seed,data 模式只清部分資料;production reset 限制不變。

**移除授權宣告不會自動撤銷既有授權。** 已定案保留 relations 只補不刪的行為。例如從種子清單刪掉角色與模組的綁定,重跑 seed 不會刪除資料庫原有綁定;人員須另行管理撤銷,或在有明確需求時安排資料遷移。本次不新增自動清理機制。

**不新增角色綁定,仍可能擴大既有 wildcard 的能力。** `packages/domain/src/permission/keys.ts` 的同層 `*` 可涵蓋新增動作;`seeds/role-bindings.ts` 也會把新非根專屬模組加入租戶管理員種子模板,既有租戶副本則不自動同步。已確認保留同層 wildcard 涵蓋新增動作,升級報告列出受影響角色與新增能力;個別權限不自動擴大,全新模組另行授權。保留現行模板收錄與授權只補不刪的機制,示範模組開關及租戶分配由人員維護;升級報告區分模板與既有租戶副本,不能把「既有租戶副本不更新」當成所有角色都不受影響。

**品牌值與通用型別分開。** 專案名稱與主色來自 `packages/project-config/src/project/public.ts`,`packages/ui/src/theme/brand.ts` 提供通用型別及色盤算法,`brands/default.ts` 提供中性預設。AppProviders/Storybook 依專案值組裝 brand,通用 UI 不讀專案設定。初始化仍須沿品牌註冊表核對資產、業務文案與外部資源,不能只全文替換品牌字串。

**Figma 的換品牌不是永久繼承。** 既有隔離實測確認接受元件更新能保留原本部分覆寫,但新增圖層、新插入元件及變體切換仍會帶回底座色;須補套與驗收。尚未測完整正式元件、新增 token 或刪除重建圖層的所有情況。Git 正式版本與 Library 發布的對照方式仍待定案。

## 後續初始化盤點範圍

| 類別           | 必須列清楚的輸入與位置                                                                                                                                      | 完成判準                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 專案識別       | repo、名稱、slug、根 package 名稱、品牌文案與資產;查 `docs/branding.md` 及實際引用                                                                          | 新專案不顯示 CookHome 品牌;CookHome 抽離後保持原值        |
| 主題與前台     | 後台與共用 UI 主色、tokens、providers、Storybook、亮暗模式;前台另列專案畫面、風格與 metadata                                                                | 三個 app 結構完整;前台保留專案設計,不強制沿用後台主題     |
| 資料           | DB 名、根組織、首任管理員、示範資料策略、seed 欄位歸屬                                                                                                      | 空庫可初始化;已有資料可升級且不洗掉設定                   |
| 雲端與開發工具 | GitHub repo/environments/Project、CI、agent/skill 工具設定、GCP project、WIF、IAM、Artifact Registry、Cloud Run、Secret Manager、GCS、DNS、Vercel、寄信網域 | skill 引導提供每項輸入,分開記錄已提供、已建立與已驗證狀態 |
| 文件與 skills  | 術語、品牌/環境註冊表、模組 help、issue tracker、部署操作、skill 正本與引用                                                                                 | 共用文件無專案操作值;專案文件能找到自己的值               |
| Figma          | 底座 Library、專案品牌庫及畫面檔、token 對照與版本對照                                                                                                      | 可新增品牌並接受更新;補套後保留連結與客製內容             |

## 建議的同步驗收

以專案記錄的底座版本為基線,在升級分支整合指定正式版本。記錄新增/修改/刪除的底座內容及客製替換受影響項目,保留共同祖先;不以複製整個資料夾取代整合。底座刪除或改名的入口若仍被專案引用,必須列為遷移事項。

最低演練包含:建立一個不同品牌及新增業務模組的測試專案,替換一個治理頁;在底座修改共用元件、API 與 seed 後升級。確認新功能到位、客製頁及品牌保留、使用者設定與資料保留,並完成 Figma 接受更新及品牌補套。回收演練則從同一底座基線整理一項通用修正,排除專案品牌與業務,再驗其他引用專案能升級。

## 下一步

B 的整合驗收以正式頁面/help、真 AppModule 與 GraphQL 產物核對共同契約;文件路徑不代替測試及發布證據。A 的品牌與部署設定保持原值,本包不改 seed/migration 所有權。

`CONTEXT.md` 已定義底座、引用專案、專案登記入口與組裝入口。後續 C–F 依[共同計畫](../plans/base-sync.md)設計 seed 分工、初始化、Figma 與版本同步。尚未建立底座 repo、通用初始化/同步 skill 或完成跨 repo 升級演練;GraphQL 產物與 lockfile 仍須整合重產,不能整份套用單方版本。
