# 底座統一 base 欄位、軟刪除與個資保護

## 基礎欄位

全部 collection 由共用 Mongoose plugin(`baseFieldsPlugin`)補上:`createdAt` / `updatedAt`(timestamps)、`createdBy` / `updatedBy`(自操作者上下文填,無登入主體的流程為 null)、`deletedAt`(軟刪除)。schema class 不重複宣告這些欄位。各表的「偏好設定」統一命名 `settings`,為受控 JSON — 已知 key 於程式碼中定義與驗證,不做自由塞值。

## 軟刪除

- 「刪除」= 寫入 `deletedAt` 時間戳,資料仍在庫裡;之後所有查詢**預設排除**(視為不存在),要連已刪除一起看須明講 `includeDeleted`。
- 已刪除的資料不能再被更新(更新的查詢也找不到它);再刪一次回 null。
- **BaseRepository 不提供硬刪除**。真正從資料庫抹除(個資清除、清理測試資料)一律以 cleanup migration 執行(ADR-0002),不給 API 硬刪按鈕。

## 更新保護

`updateById` 不得變更 `orgId`、`createdBy`、`createdAt`(含子路徑);觸及即拋錯(ADR-0005)。

## 個資保護

高敏個資(身分證 `nationalId`,底座目前無功能使用,作為機制的驗證載體保留、非必填):欄位級加密存放(AES-256-GCM,金鑰 `FIELD_ENCRYPTION_KEY` 走 Secret Manager,見 docs/env-registry.md),API 預設投影排除,明確 `select("+nationalId")` 才解密回傳。加密金鑰建立後不可輪替或刪除(舊密文會解不開)。密碼雜湊規範見 ADR-0003。
