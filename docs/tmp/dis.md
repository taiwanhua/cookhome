# CookHome 待討論與待辦

只留**還開著**的討論與待辦,每項附現況;做完就從本檔刪掉(歷史查 git)。已定案的規則不寫在這裡:架構事實見 `docs/architecture.md`,程式規範見 `docs/standards/`,領域規則見 ADR 與 `CONTEXT.md`,部署見 `docs/deployment.md`,常用指令與 skill 見 `docs/agents/toolbox.md`。

引用本檔時用**條目標題的關鍵字**(例:「dis.md 搜『Atlas』」),不用編號。

## 需要討論決策

### 底座維護邊界與跨專案同步

待完成的初始化、Figma 工具與跨 repo 升級/回收見[底座同步計畫](../plans/base-sync.md);進度及驗收見對應 issue/PR。現行設定、功能來源與維護歸屬見[架構](../architecture.md#底座與專案的維護歸屬),seed/migration 見[資料層](../concepts/data-layer-and-isolation.md#種子資料與遷移),不在本檔另存一份要求。

### 自訂 `/to-figma` skill

設計系統收尾的唯一剩項:由 spec 產出 Figma 設計稿,之後實作照稿產出程式碼。Figma 端的做法(殼元件實例覆寫、備用槽、RWD 三檔)已寫在 `docs/standards/general/figma.md`。

現況:未開票;與下一項「module-scaffold 入口與設計流程整合」合併設計。

### module-scaffold 入口與設計流程整合

新增後台模組的步驟以 `docs/agents/module-scaffold.md` 為正本(藍本 = 示範模組 1 / 2),skill 入口須沿用其專案登記路徑。需求引導仍須取得:①模組中文命名 ②掛哪個側欄群組、共幾層(1~3)③生成哪些頁(列表 / 詳情 / 新增 / 編輯)④頁籤顯示名稱 ⑤有無檔案 / 圖片欄位 → 引導選公開或私有 bucket(準則見 ADR-0010:預設私有;需 CDN / SEO / 未登入展示 / 社群分享才公開)⑥要不要宣告資料範圍目標(`dataScopeTarget`,ADR-0008)。

現況:已有 `.claude/skills/module-scaffold/` 入口,build 流程與驗收指向共同文件,沿用專案登記路徑。不同工具的本機副本一致性與 `/to-figma` 整合仍待整理,依 toolbox/issue tracker 的共同流程,不另訂授權或測試 SOP。

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

seed(`apps/db-migrator/seeds/`)與 api(底座 `apps/api/src/database/schemas/`、專案 `src/project/database/`,見資料模型地圖)的欄位形狀各有來源(ADR-0002 種子段);漂移開始造成問題時,評估抽成 packages 套件供兩邊 import 型別。

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

現況:底座/專案登記與 import 方向見 STRUCT-12;跨業務 module 的一般依賴細則、錯誤處理與 schema 演進仍待更多 feature 經驗再歸納,未開票。

## 下一步

初始化及同步工具依共同計畫接續。食譜域第二輪 `/domain-modeling` 用來解開「設計殘項」,與底座同步的未完成項目分開追蹤。
