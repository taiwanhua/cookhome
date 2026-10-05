# 底座跨專案維護與同步計畫

本文件只保留尚未完成的跨 repo 版本升級、回收與整體演練。現有行為見下列正式文件;實作進度、驗收及部署結果以 issue/PR 為準。

## 正式文件入口

- [架構與維護歸屬](../architecture.md#底座與專案的維護歸屬):底座核心、專案內容與固定組裝。
- [前端架構](../concepts/frontend-architecture.md)、[資料層](../concepts/data-layer-and-isolation.md)、STRUCT-12:頁面、help、API 與資料登記契約。
- [設定交付](../concepts/data-layer-and-isolation.md#種子資料與遷移)、[操作](../deployment.md#設定與資料更新)、ADR-0002:seed/migration 來源、受管定義、更新與重置。
- [初始化操作](../agents/project-bootstrap.md)、[初始化索引](../project-initialization.md)、[品牌註冊表](../branding.md)、[部署](../deployment.md):專案值、設定來源與操作。
- [Figma 資源](../branding.md#設計資源登記)、[品牌同步操作](../agents/toolbox.md#figma-品牌同步):Library、專案品牌補套與驗證紀錄。

接手先讀 `CLAUDE.md`、[協作規則](../agents/collaboration.md)、負責的 issue 全文與留言。未定介面依 [issue tracker](../agents/issue-tracker.md) 固定規格後才進 Ready;未完成範圍以本計畫為準,現有工具與設計資源以正式文件及驗證產物為準。完成的內容依 STRUCT-11 歸入既有正本並從本計畫移除。

## F:正式版本升級、回收與整體演練

共用 CLI、資料狀態 JSON 與發布前核對的操作正本在 [deployment](../deployment.md#底座首次接軌與版本升級) 與 [toolbox](../agents/toolbox.md#底座升級與回收);JSON 欄位以程式型別為準。本計畫不另維護工具契約。

尚待完成:

1. 發布底座正式工具版本,由 CLI 對引用專案準備升級,審查完整差異並走既有 PR 流程。採用記錄、正式來源與共同 ancestry 須一致,不能以候選合併代替正式升級。
2. 從引用專案整理一項有實際用途的 common-only 改良,使用 inspect/contribute 回到底座。記錄精確來源、審查通用性與相容性,正式發布後再向引用專案升級。
3. 整合不同品牌、新業務模組及治理頁 replacement 的既有應用驗收,以及新工具的真 Git 案例與正式跨 repo 操作證據。核對專案內容保留、共用 UI/API/seed 相容性及 wildcard 影響;未知明列,不以模擬結果冒稱外部系統已驗證。
4. 最後將操作差異歸回既有正本,移除此計畫並更新所有引用。commit、逐次驗證與發布歷程留 issue/PR,不另建需求或版本帳。

驗證只覆蓋受影響範圍。Figma 來源與 scope 未變時沿用有效證據;有新的寫入才做既有前置核對與回讀,不重做首次全量搬遷。發布前報告須核對實際環境與累積未部署差異;唯讀核對成功不等於部署批准,不得以 reset 代替升級。
