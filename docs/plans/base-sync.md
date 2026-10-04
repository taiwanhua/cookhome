# 底座跨專案維護與同步計畫

本文件只保留尚未完成的 Figma 與跨 repo 同步工作。現有行為見下列正式文件;實作進度、驗收及部署結果以 issue/PR 為準。

## 正式文件入口

- [架構與維護歸屬](../architecture.md#底座與專案的維護歸屬):底座核心、專案內容與固定組裝。
- [前端架構](../concepts/frontend-architecture.md)、[資料層](../concepts/data-layer-and-isolation.md)、STRUCT-12:頁面、help、API 與資料登記契約。
- [設定交付](../concepts/data-layer-and-isolation.md#種子資料與遷移)、[操作](../deployment.md#設定與資料更新)、ADR-0002:seed/migration 來源、受管定義、更新與重置。
- [初始化操作](../agents/project-bootstrap.md)、[初始化索引](../project-initialization.md)、[品牌註冊表](../branding.md)、[部署](../deployment.md):專案值、設定來源與操作。
- [Figma 隔離測試](../branding.md#隔離品牌相容性測試):測試資產、可重現結果與限制。

接手先讀 `CLAUDE.md`、[協作規則](../agents/collaboration.md)、負責的 issue 全文與留言。未定介面依 [issue tracker](../agents/issue-tracker.md) 固定規格後才進 Ready;未完成範圍以本計畫為準,現有工具與設計資源以正式文件及驗證產物為準。完成的內容依 STRUCT-11 歸入既有正本並從本計畫移除。

## E:Figma 品牌與版本同步

正式 Library 的檔案、用途、節點與中性品牌值見[品牌註冊表](../branding.md#figma)。共用元件、後台參考畫面及其 foundations 接線已在正式檔案驗證;本節只保留 CookHome consumer 品牌補套與正式版本交付。

### E3 工具契約

品牌補套 CLI 已合入 dev/staging,尚未隨 main 正式版本交付。入口是 `scripts/figma-sync/prepare.mjs`;六命令、完整傳輸、receipt 保存及中斷恢復的操作正本見 [Figma 品牌同步](../agents/toolbox.md#figma-品牌同步)。型別與精確審查欄位見同目錄的 `core-contract-schema.mjs`、`core-contract-review.mjs`,來源比對與客製保留以 `core-plan-consumer-guards.mjs`、`core-plan-consumer-ownership.mjs` 為準。

E3 的離線測試、同提交 CI、兩品牌共用元件及代表更新/客製保留已有適用證據。未改動的行為沿用既有結果;只補受修改影響或仍缺證據的項目。全量 TEST 參考頁重跑不作 E4 或正式版本交付的前置。

### CookHome 首次品牌補套

- 以 fresh inventory 盤點含隱藏後代的實際品牌 variable/style key,保留業務畫面、Front Shell、食譜卡片、POC、文字、商標與私人覆寫。空頁與局部 roots 明列涵蓋範圍,不能把局部驗證報成全檔完成。
- 依實際 counterpart/source slot 分開處理 CookHome 本地舊品牌與新 base 來源。新 base counterpart 下的舊 CookHome 品牌 override,只有現值角色與來源角色相同且明示 fresh `adopt-source` 才接管;角色不同、私人變數、固定值及同 leaf 混合來源須列差異,不自動改意圖。本地 master 先核對傳播到 consumer 的影響。
- 沿正常 `scan → review → plan → apply → record` 產物接續,不手編 inventory 或 receipt。逐 scope 完整驗證並累積同檔 receipt;確認品牌六色、Shadow/Primary、來源連結及客製保留,再以 fresh scan 驗證重跑零修改。
- 將 verified receipt 及必要的可攜證據納入既有交付,更新 CookHome 的品牌登記與操作正本。Library 已接受更新不等於 consumer 品牌已補套。

### E 正式版本交付

E3 工具與 E4 接軌變更須依 feat → dev → staging → main 流程交付,完成兩個 repo 的正式版本與採用記錄。尚未 release 前,不得把 dev/staging 的工具或目前 Figma 發布當成已交付的 main 版本。

`package.json.wowgoBase` 只記應用採用的正式 tag/commit。Git Release 與 Library 發布描述互相指向,記錄完整 commit、fileKey、可核對的 Figma 版本連結、變更資產與實際接受範圍;中性內容的 Figma 發布須補上最終 Git Release 對照。資產身分留品牌註冊表、節點留 FIGMA-09、機器狀態留生成 receipt,不另建人工發布帳本。

component key 是來源身分,不是版本鎖。發布後內容再變時須重核實際狀態;不承諾只靠 Git tag 接受或回退任意歷史 Library。正式搬移、foundation 接線、參考畫面、品牌補套及中斷恢復的必要證據可沿用,不重送已成功的操作。

完成 consumer 補套、正式版本與文件交付後才結束 E,再執行 F。

## F:正式版本升級、回收與整體演練

已確認的目標:

- 向下同步以正式版本為單位,不跟每次 main commit。優先讓專案持續升級,舊版修補只作例外,不預設長期多版本支援線。
- 底座發布後,agent 為引用專案準備升級分支及 PR,分析影響、整合相容性並測試;不確定行為列待決,使用者審查合併及發布。
- 引用專案 PR 主動辨識底座改動與共用價值,提出回收建議,由使用者決定整理與納入;不自動接受回收。
- 升級保留專案品牌、設定、客製頁、帳號、組織與業務資料;資料轉換走明確 migration,不能以 reset 取代。
- 底座治理頁原版持續更新,不得整個 `system/` 排除升級;客製版須檢查 API、權限及互動相容性。依賴宣告整合後更新 lockfile,不整份選上游或本地。
- 升級報告列出新增能力及 wildcard 影響,區分種子模板、既有租戶副本與個別權限角色;Figma 接受更新及品牌補套納入同一次驗收。

正式 tag/Release、採用版本記錄與共同祖先操作見初始化及 deployment 正本。仍待設計回收分支起點、引用專案清單、觸發器、憑證權限、失敗回報與重試,並完成向下升級與回收的工具。

前置是 E;初始化與手動接軌/升級操作見上列正本。整體演練需以不同品牌、新增業務模組及替換治理頁的引用專案,升級共用 UI、API、seed 與 Figma;再回收一項通用修正,發布並再次向下升級。驗收須能從 repo 與操作文件重現,不能只以計畫或 skill 檔存在判定完成。
