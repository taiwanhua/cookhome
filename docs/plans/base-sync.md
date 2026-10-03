# 底座跨專案維護與同步計畫

本文件只保留尚未完成的初始化、Figma 與跨 repo 同步工作。現有行為見下列正式文件;實作進度、驗收及部署結果以 issue/PR 為準。

## 正式文件入口

- [架構與維護歸屬](../architecture.md#底座與專案的維護歸屬):底座核心、專案內容與固定組裝。
- [前端架構](../concepts/frontend-architecture.md)、[資料層](../concepts/data-layer-and-isolation.md)、STRUCT-12:頁面、help、API 與資料登記契約。
- [設定交付](../concepts/data-layer-and-isolation.md#種子資料與遷移)、[操作](../deployment.md#設定與資料更新)、ADR-0002:seed/migration 來源、受管定義、更新與重置。
- [初始化索引](../project-initialization.md)、[品牌註冊表](../branding.md)、[部署](../deployment.md):專案值、設定來源與操作。
- [Figma 隔離測試](../branding.md#隔離品牌相容性測試):測試資產、可重現結果與限制。

接手先讀 `CLAUDE.md`、[協作規則](../agents/collaboration.md)、負責的 issue 全文與留言。未定介面依 [issue tracker](../agents/issue-tracker.md) 固定規格後才進 Ready;本計畫不代表外部資源已建立或工具已啟用。完成的內容依 STRUCT-11 歸入既有正本並從本計畫移除。

## D:新專案初始化與底座基線

底座 repo 為 `taiwanhua/wowgo-base`,公開且保留來源完整 Git 歷史。初始化、雙工具 skill、採用版本欄位與重跑操作見[共用初始化操作](../agents/project-bootstrap.md);候選程式與文件的審查、首版 annotated tag/Release 及進度以各票為準,不能只因 repo 已存在便視為正式底座可用。

待完成的實際演練:

- 以正式底座版本建立新品牌專案,保留完整 front/admin/api 與共同歷史,沿現有 TS/JSON/env 來源設定;檢查畫面、build、repo/版本識別與重新 clone 接手。
- 重跑初始化保留客製來源、既有 `.env`、slug、DB/volume 與採用版本;外部整合分開記錄已提供、已建立、已驗證或明確停用。
- 兩個隔離空庫各跑初建與重跑,再以同一 SeedSet 宣告驗共用表單/流程內容一致、版本不重複;組織 ID、帳號及分派仍各自獨立。空 registry 不能代替動態定義驗收。
- 兩個實際專案同機啟動,DB、volume、port、儲存與 E2E Compose 名稱不互踩,停一邊不影響另一邊。`docker compose config` 只算離線核對。E2E 觸發仍依 issue tracker。
- CookHome 首次接軌正常合併底座正式版,逐項保留品牌、食譜、前台、部署/seed/工具設定與經審查的資料層相容差異。相對自身 main,只有明列共用修正與採用版本紀錄,中性化的專案值差異須為零。
- 以實際專案補驗後續升級與共用改良回收:包含 Git 無衝突地套入上游預設值的情況,確認專案客製仍保留。完整工具與 Figma 驗收仍依 E/F。

Git 操作、main 前進後重建、完整 diff 審查與衍生產物重產,以 [deployment](../deployment.md#底座首次接軌與版本升級) 為唯一操作正本。候選版額外發現的共用缺口須明列修正,不可用任意隔離 bypass 或清庫解決。不可變 legacy migration 與 seed 快照保留,已驗項目及限制記在 issue/PR。

## E:Figma 品牌與版本同步

規劃底座共用 Library、每專案品牌 Library 與業務畫面檔分開。設計稿統一畫亮色;專案品牌不以占用底座 mode 表示。正式檔案拆分、Git/Library 版本對照及通用補套工具尚待實作。

同步流程須包含底座發布、專案接受更新、補套品牌、檢查元件連結與客製內容。新增實例及切換變體也要檢查;單次 Swap library 不是永久全檔主題規則。既有可行性與限制見品牌註冊表的隔離測試,不能當作所有正式元件已通過。

待固定 token/key 對照與版本識別,補驗新增 token、刪除重建圖層、所有正式元件,並在獨立測試檔證明補套可重跑、component key 不變、幾何更新及客製文字保留。此工作依品牌契約設計,可與初始化工具分開進行;操作正式 Figma 資產須另依任務授權。

## F:正式版本升級、回收與整體演練

已確認的目標:

- 向下同步以正式版本為單位,不跟每次 main commit。優先讓專案持續升級,舊版修補只作例外,不預設長期多版本支援線。
- 底座發布後,agent 為引用專案準備升級分支及 PR,分析影響、整合相容性並測試;不確定行為列待決,使用者審查合併及發布。
- 引用專案 PR 主動辨識底座改動與共用價值,提出回收建議,由使用者決定整理與納入;不自動接受回收。
- 升級保留專案品牌、設定、客製頁、帳號、組織與業務資料;資料轉換走明確 migration,不能以 reset 取代。
- 底座治理頁原版持續更新,不得整個 `system/` 排除升級;客製版須檢查 API、權限及互動相容性。依賴宣告整合後更新 lockfile,不整份選上游或本地。
- 升級報告列出新增能力及 wildcard 影響,區分種子模板、既有租戶副本與個別權限角色;Figma 接受更新及品牌補套納入同一次驗收。

正式 tag/Release、採用版本記錄與共同祖先操作見初始化及 deployment 正本。仍待設計回收分支起點、引用專案清單、觸發器、憑證權限、失敗回報與重試,並完成實際向下升級與回收工具。

前置是 D、E。整體演練需以不同品牌、新增業務模組及替換治理頁的引用專案,升級共用 UI、API、seed 與 Figma;再回收一項通用修正,發布並再次向下升級。驗收須能從 repo 與操作文件重現,不能只以計畫或 skill 檔存在判定完成。
