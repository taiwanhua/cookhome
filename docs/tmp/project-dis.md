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

### repo 改回 private

repo 目前是 public,為了用 GitHub Actions 的免費額度(private 每月 2000 分鐘曾用完)。改回 private 時照順序做:① GitHub Settings → Billing 先提高 Actions 花費上限 ② 再把 repo 改回 private ③ 改完跑一次 Deploy 確認 workflow 正常。沒先提高上限就改,CI 與部署會停擺。

現況:使用者決定暫不改;使用者提出時再照上面三步做,不主動提醒。

### 正式環境目前沒有使用者

production 目前沒有真實使用者,升級或部署時資料風險低;但清資料(reset DB)仍是破壞性動作,要先跟使用者確認。

現況:開始有使用者後刪掉這條,之後的升級照一般資料風險處理。

## 下一步

食譜域第二輪 `/domain-modeling` 用來解開「設計殘項」,與底座同步的未完成項目分開追蹤。
