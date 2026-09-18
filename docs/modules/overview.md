# 總覽(技術)

- **模組 key**:`overview`(頂層 link 模組,`order: 0`,側欄第一列、排在「系統管理」之前;路由 `/overview`)
- **畫面**:Figma「Admin 總覽」(`Screen / Admin 總覽` 20:3;側欄第一列即 Draft/AdminSideNav 30:52 的「總覽」NavItem)。**本輪只有佔位內容**(問候 + 當前組織),實際總覽內容(統計卡、最近項目、公告)待後續票
- **相關 ADR**:[0004 權限模型](../adr/0004-permission-model.md)(模組=頁面)、[0011 權限查詢與判斷流程](../adr/0011-permission-resolution-flow.md)(`/` 導向側欄第一個可進入的 link — 有總覽權限就是 `/overview`)
- **資料**:無自有 collection;內容定案後各區塊各自讀對應模組的資料
- **為何進權限體系**(2026-09-18 定案,#66 審查):各租戶要看的總覽內容不同,必須能授權 / 收回 — 不做固定列。角色未綁 `overview` 的使用者登入後被導到側欄第一個能進的頁;一個都沒有才顯示無權限頁
- **權限備忘**:目前只有每模組固定一筆的 `overview.*`(seed 自動產生);租戶管理員模板綁 `overview` + `overview.*`(非根組織專屬,`role-bindings.ts` 自動納入);超級管理員 bypass。個別權限(如各統計卡的顯示)待內容定案後補在本檔權限表再種
- **使用者說明**:[overview.help.md](../../apps/admin/src/md/module-help/overview.help.md)
