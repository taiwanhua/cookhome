# 底座統一 base 欄位與個資保護

全部 collection 繼承統一 base 欄位(共用 Mongoose plugin):`createdAt/updatedAt`(timestamps)、`createdBy/updatedBy`(自請求上下文)、`deletedAt`(軟刪除)。各表的「偏好設定」統一命名 `settings`,為受控 JSON — 已知 key 於程式碼中定義與驗證,不做自由塞值。

高敏個資(身分證,為未來人事系統預留、預設非必填):實際收取時必須欄位級加密存放,且 API 預設投影排除(未明確請求不回傳)。密碼雜湊規範見 ADR-0003。
