# 核心關聯用單一 collection,範圍限五實體,附護欄

底座的核心關聯(Org / User / Role / Module / Permission 之間)集中在一張 `core_relationships` collection,換取底座跨專案複製時的通用性。曾考慮每種關聯一張具名 collection(可讀性與索引更好),折衷採單表 + 護欄。

## 欄位

`type` + `firstId` + `secondId` + 保留的 `thirdId` + 選配 `meta`(關聯自身資訊:授權人、時間等)+ 基礎欄位(ADR-0007)。

## 護欄

- `type` 是程式碼中的封閉 enum,**完整清單**:`org_user`(使用者屬於組織)、`org_role`(角色的擁有組織)、`user_role`(角色授予)、`role_module`(角色綁模組 = 可進入的頁面)、`role_permission`(角色綁權限)。命名順序固定為 `Org > User > Role > Module > Permission`(如 `org_user`),first / second 依此順序。
- **不在此表的**:權限→模組是唯一且不變的從屬,用 `permissions.moduleId` 直接欄位 — 原則:會增刪的多對多用關聯,固定從屬用欄位。`org_role` 雖也唯一,但保留關聯彈性(未來可能解綁),維持在本表。
- 一律用二元關聯組合表達,不建三元關聯:每個角色只屬一個組織,查 `user_role` 就能知道這筆授予來自哪個組織的角色,無需 `org_user_role`;`thirdId` 保留於 schema 但不使用(一律 null),待未來出現真正不可分解的三元語義再啟用。
- 唯一複合索引 `(type, firstId, secondId, thirdId)` 防重;`org_role` 另在 role 側建唯一索引(一個角色僅一個擁有組織)。

## 唯一出口:RelationService

- 存取一律經 `RelationService` 的具名包裝(如 `addUserToOrg`、`assignRoleToUser`、`bindModuleToRole`),禁止裸查;BaseRepository 的建構子拒收 `core_relationships`,不讓它成為第二個入口(ESLint 規則只擋裸 Model,擋不到這條路)。
- **讀取不帶操作者上下文**:關聯表沒有 orgId、不受租戶過濾;而且權限解析(ADR-0011)要先查關聯才算得出可見範圍,先有雞才有蛋。**寫入帶操作者上下文**,填 createdBy / updatedBy。
- **移除關聯 = 硬刪除**:關聯是「有 / 沒有」的事實,不是實體;唯一索引含已軟刪除的文件,軟刪會讓「移除後再加入」被防重擋下。關聯表只存**現況**,「曾經屬於誰」的歷史在 `audit_logs`(由模組層寫入,ADR-0004)。
- 批次原語:`linkMany`(嚴格防重,重複即拋錯)、`ensureLinks`(冪等,回「新增 / 未變」)、`unlinkMany`。
- 種子(db-migrator)不 import api,以原生 driver 直寫本表(ADR-0002);冪等語意與 `ensureLinks` 相同。

其他業務域(如食譜)的關聯不進此表,各自建具名關聯。
