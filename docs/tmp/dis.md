# CookHome 待討論與待辦

只留**還開著**的討論與待辦,每項附現況;做完就從本檔刪掉(歷史查 git)。已定案的規則不寫在這裡:架構事實見 `docs/architecture.md`,程式規範見 `docs/standards/`,領域規則見 ADR 與 `CONTEXT.md`,部署見 `docs/deployment.md`,常用指令與 skill 見 `docs/agents/toolbox.md`。

引用本檔時用**條目標題的關鍵字**(例:「dis.md 搜『Atlas』」),不用編號。

## 需要討論決策

### 底座維護邊界與跨專案同步

待完成:在已定案的設定與功能登記邊界上,補齊 seed/migration 所有權、初始化、Figma 工具、改良回收與正式版本同步流程。底座核心與專案頁面/業務的歸屬不重開討論。

待設計:獨立底座 repo 與引用專案的建立命令、seed/migration 來源、完整初始化 skill、改良回收與正式版本升級 PR。共同 Git 歷史原則已定,仍需固定回饋分支起點、發布 tag、升級分支保留合併祖先、資料遷移與跨專案驗證方式;GitHub Template 的歷史行為須與後續 merge 策略一起評估。

現況:A 專案設定與部署識別已交付;B 的頁面/help、API 功能與資料、GraphQL 來源契約已固定,候選程式與文件正依[共同規格](../plans/feature-registration.md)整合驗收。來源地圖見[底座維護邊界盤點](base-boundary-inventory.md)及[初始化索引](../project-initialization.md),seed 欄位見[初始化盤點](project-bootstrap-inventory.md)。最終驗收與發布以 issue/PR 為準;尚未建立底座 repo 或啟用跨 repo 同步。C–F 的依賴與完成判準見[底座同步計畫](../plans/base-sync.md)。

Figma 同步待實作與 skill 化:將「底座 Library 發布 → 專案接受更新 → agent 補套專案品牌 → 檢查元件連結、品牌遺漏與客製內容」納入完整同步流程,並涵蓋新增元件與切換變體後的品牌檢查。與 Git/程式碼升級一併設計驗收,另釐清程式版本與 Library 更新的對應方式。

現況:使用者已確認 Figma 屬於同步範圍。Professional 隔離實測已驗證換色、保留元件連結、接受更新及補套品牌;正式設計檔拆分與通用 skill 尚未實作。測試檔位置見 `docs/branding.md`「隔離品牌相容性測試」,可攜證據與未測範圍見共同計畫「Figma 隔離實測」。

### 自訂 `/to-figma` skill

設計系統收尾的唯一剩項:由 spec 產出 Figma 設計稿,之後實作照稿產出程式碼。Figma 端的做法(殼元件實例覆寫、備用槽、RWD 三檔)已寫在 `docs/standards/general/figma.md`。

現況:未開票;與下一項「module-scaffold 入口與設計流程整合」合併設計。

### module-scaffold 入口與設計流程整合

新增後台模組的步驟以 `docs/agents/module-scaffold.md` 為正本(藍本 = 示範模組 1 / 2),skill 入口須沿用其 B 登記路徑。需求引導仍須取得:①模組中文命名 ②掛哪個側欄群組、共幾層(1~3)③生成哪些頁(列表 / 詳情 / 新增 / 編輯)④頁籤顯示名稱 ⑤有無檔案 / 圖片欄位 → 引導選公開或私有 bucket(準則見 ADR-0010:預設私有;需 CDN / SEO / 未登入展示 / 社群分享才公開)⑥要不要宣告資料範圍目標(`dataScopeTarget`,ADR-0008)。

現況:已有 `.claude/skills/module-scaffold/` 入口,build 流程與驗收指向共同文件,沿用專案登記路徑。不同工具的本機副本一致性與 `/to-figma` 整合仍待整理,依 toolbox/issue tracker 的共同流程,不另訂授權或測試 SOP。

### 專案模板 skill(project-bootstrap)

單獨盤點新專案初始化的所有設定與修改位置,依 `docs/branding.md`、`docs/env-registry.md`、`docs/deployment.md` 與實際程式確認,涵蓋品牌、雲端資源、開發工具、資料庫、環境變數及所有須分別設定的外部整合與驗證方式。確認清單後製作 skill,引導使用者提供必要輸入,分開記錄已提供、已建立與已驗證狀態;讓新專案從底座正式版本建立獨立 repo,保留共同 Git 歷史,再完成初始化。前台畫面與風格由專案設計,不把接入後台主題當成初始化必要工作。共用名詞整理進 `CONTEXT.md`,共用文件與 skill 避免寫死引用專案品牌。

現況:[初始化索引](../project-initialization.md)已有 A 的設定正本及 B 的專案登記來源,seed 欄位與外部資源亦有盤點;初始化 skill 尚未實作。依[底座同步計畫](../plans/base-sync.md)的 C/D 前置設計排票,確保初始化產物可持續升級且保留專案專有內容;新 repo、外部資源與共同歷史仍須實際驗證。

### Budget 終極斷路器

Pub/Sub + Cloud Function 在超支時自動解綁 billing。

現況:未開票;看過前幾個月帳單再決定(目前只有 Budget NT$600 三段郵件警告)。

### AI 自動 PR review 的時機

GitHub Actions 上的 AI review 與本地 `/code-review` 怎麼分工。

現況:未開票,待使用者裁決。

### Turbo remote cache

現況:未開票;等 CI 時間變長再評估。

### 設計殘項(等食譜域第二輪 domain modeling)

食譜詳情頁、分類頁;front 會員線(註冊 —— 含 account 欄位、登入、個人頁、寫食譜、收藏);會員管理頁(admin)。

現況:未開票;先做食譜域第二輪 `/domain-modeling`,這批才有規格可畫。

### 抽 `@repo/db-schemas` 共用型別

seed(`apps/db-migrator/seeds/`)與 api(底座 `apps/api/src/database/schemas/`、專案 `src/project/database/`,見資料模型地圖)的欄位形狀各有來源(ADR-0002 種子段);漂移開始造成問題時,評估抽成 packages 套件供兩邊 import 型別。B 的來源分區不包含此共用套件。

現況:未開票;尚未出現漂移。

### BaseRepository 支援 populate

populate 的子查詢不帶操作者上下文,對租戶資料會拋錯(ADR-0005 已知限制);需要時加 `populate` 選項,由 repository 轉傳上下文(`apps/api/src/database/base.repository.ts`)。

現況:未開票;目前沒有模組需要 populate。

## 小任務

### Atlas 拆三個 cluster

已定案要拆;時機是 production 有真實流量、升 M10 時(或先開三個 Atlas project 各一個 M0)。過渡加固:三環境 URI 皆 `maxPoolSize=10`(`docs/deployment.md`「安全與費用備忘」)。

現況:未開票,等流量。

### Claude hook 在 git worktree 誤報

`scripts/claude-hooks/post-edit-check.mjs` 以 `process.cwd()` 當 repo 根跑檢查:session 在 worktree 內啟動時正常;若 session 在主 checkout、卻編輯 worktree 裡新增的 workspace,turbo / 套件查找會落在主 repo,可能誤報「No package found」。修法:以「被編輯檔案向上找到的 repo 根」為工作目錄。

現況:未開票;worktree 內啟動的 agent 未再回報,主 checkout 編輯 worktree 檔的情形未驗證。

## 外部條件觸發(追蹤中)

### unicorn 升級

`eslint-plugin-unicorn` 釘在 65(`packages/config-eslint/package.json`),等 ESLint 10 生態穩定,連 ESLint 一起升。

現況:等外部條件。

### api 錯誤處理總策略 / module 邊界細則 / schema 演進規範

schema 演進指向後相容 + 破壞性變更配遷移腳本,落點 `docs/standards/api/`。

現況:底座/專案登記與 import 方向已依 B 固定;跨業務 module 的一般依賴細則、錯誤處理與 schema 演進仍待更多 feature 經驗再歸納,未開票。

## 下一步

底座工作先完成 B 整合驗收,再依共同計畫接續 C–F 的規格與交付。食譜域第二輪 `/domain-modeling` 用來解開「設計殘項」,與底座同步的未完成項目分開追蹤。
