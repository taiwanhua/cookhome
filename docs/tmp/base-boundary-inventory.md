# 底座維護邊界盤點草案

本表供確認抽離邊界與同步規則。現有程式已具備主題注入、頁面登記及 seed 欄位保護,但底座與專案內容仍共用多個組裝檔。直接複製後各自修改,升級仍會反覆碰到相同檔案。

「現況」依程式與文件核對;「建議」尚未成為實作或正式規範。完整決策、本批交付與後續工作包見 [底座同步計畫](../plans/base-sync.md);本表保留子系統與主要組裝入口證據,逐檔初始化與 seed 欄位見 [初始化盤點](project-bootstrap-inventory.md)。根組織初始值保護、API 改值/清空後重跑 seed 的驗收及發布證據由 [根組織修正票](https://github.com/taiwanhua/cookhome/issues/597)追蹤。其餘抽離未實作;盤點不執行資料庫、雲端或正式 Figma 操作,Figma 隔離證據已納入共同計畫。

## 已確認的原則

- 根組織名稱與描述均屬專案初始值:建立新專案時先重新指定該專案的 seed;一般部署/升級重跑 seed 保留 UI 已修改的初始值欄位。明確清庫並強制完整還原時,清除修改並以該專案的 seed 重建,不是回到底座品牌。此要求不代表所有系統定義都停止同步,欄位仍須分類。

- 新增權限採 A:維持既有同層 wildcard 語意,持有模組 `*` 的角色涵蓋該模組新增動作;只持有個別權限者不自動取得新增動作。全新模組另行授權。升級報告須列出受影響角色與新增能力。

- 示範程式與藍本由底座維護,專案業務另建模組。正式環境也允許灌入示範資料;保留示範模組初建 `enabled=true` 的現行行為,開關模組與租戶分配由人員手動維護。初始化不強制停用、排除模板或自動撤銷分配;一般升級須保留人員已調整的啟用狀態。

- 刪除 seed 授權宣告維持現行行為:只停止補建該關聯,不自動刪除資料庫既有授權。實際撤銷由人員管理操作或另行明確授權的資料遷移處理。

- 前台畫面、版型與風格由專案客製;底座保留完整 front app 骨架與共用能力。專案依需要選擇共用 UI,不要求前台自動接入 `AppThemeProvider` 或跟隨後台主題。

- 表單引擎、審核流程與申請中心全部列為底座標準能力,底座維護引擎與預設畫面;各專案/租戶維護自己的表單、流程定義與業務資料。

- 底座與引用專案各自獨立 repo,建立專案時保留共同 Git 歷史;每個專案固定帶 front、admin、api。
- 底座內容與專案內容從起點就分資料夾存放,各自維護登記清單,由固定組裝入口讀取。專案新增與客製替換分開登記,底座原版保留。分資料夾與固定入口已確認;具體路徑、介面及檔案搬移尚未實作。
- 權限與租戶隔離等核心由底座維護;專案透過設定與擴充滿足需求。治理頁允許另存客製版,保留底座原版與受保護介面。
- 以正式版本同步,優先讓專案持續升級;舊版修補只作例外。agent 準備升級 PR,由使用者審查合併與發布。
- 初始化與升級分開,升級保留專案設定及既有資料;Figma 接受 Library 更新後的品牌補套與檢查也屬同步範圍。
- 共用名詞進 `CONTEXT.md`;初始化需另作完整盤點再製作 skill。所有新專案需分別設定的項目都納入,包含品牌、雲端資源、開發工具、資料庫、外部服務與環境;skill 引導使用者提供必要輸入,分別記錄已提供、已建立與已驗證狀態。完整決策見 [底座同步計畫](../plans/base-sync.md)。

## 維護歸屬建議

下表路徑相對 repo 根目錄。「底座維護」指向上回收、由正式版本分發,不表示禁止專案提出修改。「專案擴充」仍須遵守底座介面與權限規則。

| 項目               | 現況位置與證據                                                                                                                                                        | 建議歸屬與擴充方式                                                                           | 升級方式與驗收                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 權限解析與資料隔離 | `apps/api/src/permission/`、`database/base.repository.ts`、`database/plugins/tenant-scope.plugin.ts`、`data-scope/`;共用 key 規則在 `packages/domain/src/permission/` | 底座維護;專案宣告自己的權限與資料範圍,不替換解析及隔離規則                                   | 合併底座修正;跑核心權限及跨租戶測試,再驗專案模組                                                |
| 登入與帳號治理     | `apps/api/src/auth/`、`users/`、`orgs/`、`roles/`                                                                                                                     | 核心登入、授權、租戶開通由底座維護;品牌、網址由專案設定                                      | 驗登入、刷新、登出、密碼流程及治理權限                                                          |
| 治理頁             | `apps/admin/src/pages/system/`、`app/module-pages.tsx`                                                                                                                | 原版底座維護;專案客製版另外登記替換,不得以整個 `system/` 排除更新                            | 同時更新原版並檢查客製版的 API、權限、欄位與互動相容性                                          |
| 後台殼與路由守門   | `apps/admin/src/app/routes.tsx`、`AdminShell/`、`guards/`                                                                                                             | 殼與守門底座維護;品牌及頁面入口可設定,較大版型差異以明確擴充點承接                           | 守門、側欄、頁籤與客製頁一起驗;目前 routes 仍直接引用固定登入頁                                 |
| 表單與審核引擎     | `apps/api/src/forms/`、`workflows/`;admin 的 `components/form-engine/`、表單與流程治理頁;`packages/domain/src/`                                                       | 已定案:表單引擎、審核流程與申請中心及其預設頁由底座維護;表單、流程定義和業務資料歸專案或租戶 | 引擎升級驗既有版本、提交、修訂、審核實例及客製組裝;不把執行期表單當共用 seed 覆寫               |
| 稽核、儲存與寄信   | `apps/api/src/audit/`、`storage/`、`mail/`                                                                                                                            | 機制底座維護;bucket、寄件品牌與網址專案設定;特殊供應商需求先定 adapter 介面                  | 驗既有檔案可讀、簽名、通知與稽核;保留專案資源設定                                               |
| 食譜業務           | `apps/api/src/recipes/`、`apps/front/src/components/HomeView/`、`packages/graphql/src/documents/recipes.graphql`                                                      | CookHome 專屬;底座保留中性前台入口,食譜另由專案組装                                          | 升級底座不替換食譜內容;由專案驗 API 與前台                                                      |
| 示範模組           | `apps/api/src/demo-items-one/`、`demo-items-two/`;admin 的 `pages/demo/`;`apps/db-migrator/seeds/demo-items.ts`                                                       | 已定案:示範程式與藍本由底座維護;專案複製成自己的模組,不直接改示範正本                        | 正式環境允許示範資料且保留初建啟用;開關與租戶分配由人員維護,升級保留既有啟用值                  |
| 前台畫面與風格     | `apps/front/src/app/`、`apps/front/src/components/`                                                                                                                   | 已定案:畫面、版型與風格歸專案;底座保留完整 app 骨架與共用能力                                | 升級共用能力保留專案設計;是否採用共用 UI 與後台主題由專案決定                                   |
| 共用 UI 與品牌     | `packages/ui/src/theme/brand.ts`、`create-theme.ts`、`brands/cookhome.ts`、`AppThemeProvider/`                                                                        | UI、語意 tokens、色盤算法底座維護;品牌值專案維護。`AppThemeProvider` 已收 `brand` 與儲存鍵   | 合併 UI 後驗專案主題與亮暗模式;不把專案色盤換回底座色                                           |
| 文案與多語         | `packages/i18n/src/index.ts` 直接組合 common/front/admin 訊息;品牌在 `messages/*/common.json`                                                                         | 共用訊息底座維護;品牌、業務及核准覆寫放專案訊息來源,建立合成規則                             | 同時驗 key、參數與語系完整性;不能用整份專案 JSON 蓋掉新增共用 key                               |
| GraphQL            | `apps/api/src/app.module.ts` 混合核心與食譜模組;`packages/graphql/codegen.ts` 讀整份 schema 與 documents                                                              | 核心與專案分開登記;生成工具由底座維護,最終產物由合成後 API 產生                              | schema、operations 整合後重跑 codegen;生成碼不人工解語意衝突                                    |
| 模組與 seed        | `apps/db-migrator/seeds/modules.ts`、`registry.ts` 集中登記;`src/seed/` 有欄位保護                                                                                    | runner 由底座維護;底座及專案宣告分開,每個 key 與欄位明確歸屬                                 | 檢查重複 key、父子依賴與允許更新欄位;驗保留使用者設定與重跑冪等                                 |
| migration 與 reset | `apps/db-migrator/migrations/`、`src/migration-filename.ts`、`src/reset/`                                                                                             | runner 與安全限制由底座維護;migration 分底座及專案來源,保留全域唯一識別與執行紀錄            | 在已有專案資料的副本驗順序及重跑;升級不得呼叫 reset。現有 reset 依 DB 名判環境,新專案命名也需驗 |
| 部署與環境         | `.github/workflows/deploy.yml`、`reset-db.yml`、`deploy/env/*.yaml`;詳見 `docs/env-registry.md`、`docs/deployment.md`                                                 | 共用建置部署步驟由底座維護;GCP/WIF/網域/服務名/secret 引用與 Vercel 專案值由專案持有         | 升級 workflow 保留環境值;新增設定須報告預設與必填缺項,不能直接照搬 CookHome 資源                |
| 工具鏈與測試       | 根 `package.json`、`pnpm-lock.yaml`、`turbo.json`、`packages/config-*`、`.github/workflows/ci.yml`、`apps/e2e/`                                                       | 共用品質規則底座維護;專案依賴與測試可增加,共用設定提供明確擴充入口                           | 依賴宣告整合後更新 lockfile;驗底座與專案測試,不能整份選上游或本地                               |
| 文件與 skills      | `CLAUDE.md`、`CONTEXT.md`、`docs/standards/`、`docs/agents/`、`.claude/skills/module-scaffold/`;本地另有未追蹤 `.agents/skills/module-scaffold/`                      | 共用規則、術語及流程由底座維護;專案品牌、模組及操作值另存。第三方 skills 按來源版本管理      | 更新後檢查指路與專案資訊;先釐清兩份 scaffold 的正本,不把所有本機 `.codex/` 檔帶進底座           |
| Figma              | `docs/standards/general/figma.md`、`docs/branding.md` 與隔離實測紀錄                                                                                                  | 共用元件庫底座維護;專案品牌庫、業務畫面與客製內容專案維護                                    | 接受更新後補套品牌,檢查新增圖層、變體、component key 與客製文字;新增元件亦須檢查                |

## 抽離前需建立的組裝入口

分資料夾存放並由固定入口組合的原則已確認。以下介面與具體新目錄仍待設計,不是已存在的 API。新路徑需符合現有 apps → packages 與 admin 分層規範,避免單純加一個 project 目錄卻讓 import 反向。

| 現有集中修改點                                     | 需要的分工                                                              | 合成時必須檢查                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/admin/src/app/module-pages.tsx`              | 底座頁面登記、專案新增頁面、明確替換清單分開;最小寬度等頁面設定一併組合 | 同 key 預設報錯;只有列入替換清單才可取代,不能靠物件展開順序靜默覆蓋 |
| `apps/api/src/app.module.ts`                       | 底座核心 modules 與專案業務 modules 分開,固定啟動入口組合               | 不允許以專案同名 provider 偷換權限核心;schema 名稱重複需報錯        |
| `apps/db-migrator/seeds/modules.ts`、`registry.ts` | 共用及專案宣告分開,統一驗 key、依賴與執行順序                           | 專案不可認養底座 key;資料名稱相同不等於同一擁有者                   |
| 品牌、訊息與 mail constants                        | 專案設定統一提供名稱、slug、色盤、資產及寄件資訊;瀏覽器只取得公開欄位   | slug 與儲存鍵遷移分開考慮;CookHome 既有鍵不能因抽離而失效           |
| workflow 與環境 YAML                               | 共用執行程序讀取專案部署參數,專案環境值獨立持有                         | 新 repo 不殘留 CookHome 的部署目標、WIF 主體及網域                  |
| 共用文件與 Figma 節點表                            | 共用規則與專案識別/節點對照分開                                         | 拆檔後檢查連結、元件來源與品牌綁定;不要假設 file/node ID 可原樣搬移 |

## 目錄配置建議

以下具體路徑尚未定案或建立。保留 apps/packages 與既有前端分層,在需要區分維護歸屬的層內分資料夾;不把 app、pages、lib 整包移到 src/base 或 src/project 而繞過現有分層檢查。

| 範圍               | 建議位置與組裝方式                                                                                                            | 實作時一併處理                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 後台頁面           | `apps/admin/src/pages/base/`、`pages/project/`;登記在 `app/base/`、`app/project/`,由既有 `app/module-pages.tsx` 組合          | STRUCT-03 補上所有權分區後再照路由樹排列;專案新增與替換分開,底座頁面不直接依賴專案實作                             |
| 後台共用元件與設定 | 需要分工時在 `components/`、`hooks/`、`stores/`、`lib/` 各層內分 base/project                                                 | 頁面登記不能放 lib 再 import pages;維持既有依賴方向,另補所有權依賴檢查,明列固定組裝入口                            |
| API                | 專案業務放 `apps/api/src/project/`,由 `project.module.ts` 登記,既有 `app.module.ts` 固定掛載;專案資料層在 `project/database/` | 保留 BaseRepository、隔離 plugin 與查詢限制;提供受控的組織業務資料檢查登記,避免新增 collection 仍修改 orgs.service |
| seed               | `apps/db-migrator/seeds/base/`、`seeds/project/`,由既有 `modules.ts`、`registry.ts` 組合                                      | 先合模組宣告再生成權限、資料目標及角色模板;維持依賴順序、撞 key 檢查與已定案欄位保護                               |
| GraphQL 文件       | `packages/graphql/src/documents/base/`、`documents/project/`;現有 codegen 的遞迴 glob 收集兩者                                | `apps/api/schema.gql` 與 `src/generated/index.ts` 依整合後的來源重新產生,不保留單方舊產物                          |

help 目前只掃單層 `md/module-help/*.help.md`,若改分 base/project,收檔及明確替換規則必須一起調整。migration 現在也只有單一 migrations 目錄;分工需要另外設計收集、執行順序、穩定識別與既有 changelog 相容性,不能只搬到子資料夾就宣稱可運作。多語訊息、套件宣告與 lockfile 屬整合範圍,分資料夾不代表升級時可整份忽略。

## 需要特別處理的現況

**種子資料不是全部只寫一次。** `SeedDocumentSet.initialSeedValueFields` 指定的欄位在已有值時保留;其餘宣告欄位會同步。根組織修正將 `name` 與 `description` 列為初始值,缺少欄位才補值;API 對根描述以 null 保留明確清空的意圖,避免下次 seed 補回預設。新專案先指定自己的 seed 名稱與描述,完整清庫還原才回到該專案 seed 值;統一專案設定仍屬後續工作。現有 full 模式清庫後 migrate/seed,data 模式只清部分資料。修正票驗證 API 與 seed 串接及 data/full reset,不解除 production reset 限制。

**移除授權宣告不會自動撤銷既有授權。** 已定案保留 relations 只補不刪的行為。例如從種子清單刪掉角色與模組的綁定,重跑 seed 不會刪除資料庫原有綁定;人員須另行管理撤銷,或在有明確需求時安排資料遷移。本次不新增自動清理機制。

**不新增角色綁定,仍可能擴大既有 wildcard 的能力。** `packages/domain/src/permission/keys.ts` 的同層 `*` 可涵蓋新增動作;`seeds/role-bindings.ts` 也會把新非根專屬模組加入租戶管理員種子模板,既有租戶副本則不自動同步。已確認保留同層 wildcard 涵蓋新增動作,升級報告列出受影響角色與新增能力;個別權限不自動擴大,全新模組另行授權。保留現行模板收錄與授權只補不刪的機制,示範模組開關及租戶分配由人員維護;升級報告區分模板與既有租戶副本,不能把「既有租戶副本不更新」當成所有角色都不受影響。

**品牌值與通用型別需分開辨識。** `cookhomeBrand` 定義在 `theme/brands/cookhome.ts`,`theme/brand.ts` 是通用型別及色盤算法。品牌註冊表已對齊實際位置;初始化仍須逐列核對程式,不能只依品牌字串全文替換。

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

表單與流程引擎、示範資料與手動模組管理、wildcard 新動作、根組織名稱與描述、前台客製歸屬、初始化輸入範圍及授權宣告只補不刪均已確認。逐檔清單見 [初始化盤點](project-bootstrap-inventory.md)。本批文件與根組織修正已分票,完整驗收與發布結果由各票追蹤。尚未建立新專案或執行跨專案升級演練,後續工作包與依賴見共同計畫。

`CONTEXT.md` 已定義底座、引用專案、專案登記入口與組裝入口。下一步先列出具體目錄及檔案的維護歸屬,區分底座維護、專案維護與需要合成/重新產生的檔案,再設計登記介面與驗收。需涵蓋 API 資料層登記及刪組織前的業務資料檢查,不能只拆頂層模組清單;GraphQL 產物及套件鎖定檔也不能整份套用單方版本。其餘歸屬建議仍待逐項確認。尚未搬移檔案、抽離 repo、建立通用初始化/同步 skill 或執行升級演練。
