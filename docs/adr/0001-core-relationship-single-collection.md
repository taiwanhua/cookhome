# 核心關聯用單一 collection,範圍限五實體,附護欄

> 現況說明見 `docs/concepts/data-layer-and-isolation.md`「核心關聯」。

## 決策

- Org / User / Role / Module / Permission 之間的關聯集中在一張 `core_relationships`。
- `type` 是封閉 enum,只有五種:`org_user`、`org_role`、`user_role`、`role_module`、`role_permission`。命名順序固定 `Org > User > Role > Module > Permission`,first / second 依此順序。
- 會增刪的多對多用關聯;固定從屬用欄位(如 `permissions.moduleId`)。`org_role` 雖唯一,保留在本表以留解綁彈性。
- 只用二元關聯組合,不建三元關聯。`thirdId` 保留但一律 null。
- 唯一出口是 `RelationService` 的具名包裝;BaseRepository 拒收這張表。
- 讀不帶操作者上下文;寫帶上下文。
- 移除關聯 = 硬刪除;表只存現況,歷史在 `audit_logs`。
- 業務域(如食譜)的關聯不進此表,各自建具名關聯。

## 理由

- 單表讓底座跨專案複製時通用,不必為每種關聯各建一張表。
- 二元就夠:每個角色只屬一個組織,查 `user_role` 就知道授予來自哪個組織的角色。
- 讀不帶上下文:關聯表沒有 orgId;而且權限解析要先讀關聯才算得出可見範圍,先有雞才有蛋。
- 硬刪除:唯一索引含已軟刪除的文件,軟刪會讓「移除後再加入」被防重擋下。
- 唯一出口:ESLint 只擋裸 Model,擋不到「經 BaseRepository 存取」這條路,所以在建構子擋。

## 取捨

- 曾考慮每種關聯一張具名 collection:可讀性與索引較好,但每個專案都要跟著建。折衷採單表 + 護欄。
- 關聯兩端只存 id,各 type 指向不同 collection;要反查對象得知道 type。

## 影響

- 種子(db-migrator)不 import api,以原生 driver 直寫本表,冪等語意與 `ensureLinks` 相同(ADR-0002)。
- 「曾經屬於誰」只能從 `audit_logs` 查(由模組層寫入,ADR-0004)。
