# CookHome 待討論與待辦

只放 **CookHome 專案**的討論與待辦;底座的討論與待辦在 `docs/tmp/dis.md`(隨底座版本同步,不在本 repo 改)。只留**還開著**的,每項附現況;做完就從本檔刪掉(歷史查 git)。已定案的規則不寫在這裡:架構事實見 `docs/architecture.md`,程式規範見 `docs/standards/`,領域規則見 ADR 與 `CONTEXT.md` / `CONTEXT-PROJECT.md`,部署見 `docs/deployment.md`,常用指令與 skill 見 `docs/agents/toolbox.md`。

引用本檔時用**條目標題的關鍵字**(例:「project-dis.md 搜『Atlas』」),不用編號。

## 需要討論決策

### Budget 終極斷路器

Pub/Sub + Cloud Function 在超支時自動解綁 billing。

現況:未開票;看過前幾個月帳單再決定(目前只有 Budget NT$600 三段郵件警告)。

### 設計殘項(等食譜域第二輪 domain modeling)

食譜詳情頁、分類頁;front 會員線(註冊 —— 含 account 欄位、登入、個人頁、寫食譜、收藏);會員管理頁(admin)。

現況:未開票;先做食譜域第二輪 `/domain-modeling`,這批才有規格可畫。

## 小任務

### Atlas 拆三個 cluster

已定案要拆;時機是 production 有真實流量、升 M10 時(或先開三個 Atlas project 各一個 M0)。過渡加固:三環境 URI 皆 `maxPoolSize=10`(`docs/deployment.md`「安全與費用備忘」)。

現況:未開票,等流量。

### 啟用底座 v0.4.0 的雲端服務

底座 v0.4.0 帶來的 Cloud Scheduler 排程、即時通道(Cloudflare Worker)與列印代理程式發布,CookHome 三環境都還沒建立雲端資源,目前各自停用(admin 以 60 秒輪詢運作)。啟用步驟見 `docs/deployment.md`「Cloud Scheduler」「即時通道」「列印代理程式發布」;啟用狀態依 `docs/project-initialization.md` 記在 issue / PR。

現況:未開票;要不要開、先開哪個環境待決定。

## 下一步

食譜域第二輪 `/domain-modeling` 用來解開「設計殘項」,與底座同步的未完成項目分開追蹤。
