# 資料範圍:以權限檔位表達,BaseRepository 統一執行

功能權限(能不能進、能不能按)之外的第二軸「看得到哪些資料」,以特殊命名的權限表達:模組種子宣告其支援的檔位並生成 `模組key.data-scope.{visibility|own-org|self}` 權限(未宣告的模組沒有此族權限,用其固有規則 — 如欄位管理的全域+本租戶合併、稽核的 root 專屬)。角色在權限矩陣以單選勾選檔位;多角色取最寬;模組 wildcard 天然含最寬檔。曾考慮 role.settings 另存一套配置,採權限制的理由:重用矩陣 UI 與授予機制、防越權自動連動(僅本人檔的人下放不了可見範圍檔)、零新 schema。

執行在機制層:所有查詢經 BaseRepository(禁止裸 Model.find),依生效檔位附加條件 — visibility:`orgId ∈ 可見組織集合`;own-org:`orgId = 當前組織`;self:`createdBy = 本人`。租戶隔離(orgId ∈ 可見集合)永遠是外層保底。角色儲存後作廢權限快取即生效。

預留不實作:第四檔 `custom`(特定組織集合,清單存該筆 role_permission 關聯的 meta)與記錄層分享(模組宣告 supportsSharing + 分享關聯、查詢加 OR 條件)— 有真實需求再啟用。
