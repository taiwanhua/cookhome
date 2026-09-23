# 底座統一 base 欄位、軟刪除與個資保護

> 現況說明見 `docs/concepts/data-layer-and-isolation.md`「基礎欄位、軟刪除、更新保護」。

## 決策

- **基礎欄位**:全部 collection 由共用 plugin 補上 `createdAt` / `updatedAt` / `createdBy` / `updatedBy` / `deletedAt`;schema class 不重複宣告。
- 各表的偏好設定統一叫 `settings`,為受控 JSON:已知 key 在程式裡定義與驗證。
- **軟刪除**:刪除 = 寫 `deletedAt`;之後預設排除,要看已刪除的明講 `includeDeleted`。已刪除的不能再更新。
- **硬刪除只有兩種**:
  - 核心關聯的移除(ADR-0001)。
  - 補償刪除:本次請求剛建立、尚未對外可見的文件(如開通租戶失敗的回滾、撤銷開通)。
  - 其餘真正抹除(個資清除、清理測試資料)一律走 cleanup migration(ADR-0002),不給 API 硬刪按鈕。
- **更新保護**:更新不得變更 `orgId`、`createdBy`、`createdAt`(含子路徑),觸及即拋錯(ADR-0005)。
- **個資保護**:高敏個資(身分證 `nationalId`)欄位級加密(AES-256-GCM,金鑰走 Secret Manager),預設投影排除,明確要求才解密回傳。

## 理由

- 基礎欄位統一後,稽核、資料範圍的欄位目錄、排序都能假設每張表都有這五欄。
- 軟刪除讓誤刪可救;預設排除讓呼叫端不必每次記得過濾。
- 補償刪除非硬刪不可:`users` 的 account / email 唯一索引含已軟刪除的文件,留一筆殭屍會讓同一組帳號永遠開不了。
- `nationalId` 目前沒有功能使用,保留作為加密機制的驗證載體。

## 取捨

- 加密金鑰建立後不可輪替或刪除,否則舊密文解不開。
- 軟刪除的資料仍佔唯一索引;需要「刪了可重建」的情境要另外處理(見上面的補償刪除)。

## 影響

- 新 collection 不必自己處理時間戳、建立者與刪除。
- 密碼雜湊規範見 ADR-0003。
