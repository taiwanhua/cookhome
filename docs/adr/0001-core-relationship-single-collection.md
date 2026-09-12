# 核心關聯用單一 collection,範圍限五實體,附護欄

底座的核心關聯(Org/User/Role/Module/Permission 之間)集中在一張 `core_relationships` collection(`relationType` + `firstId` + `secondId` + 選配 `thirdId`/`meta`),換取底座跨專案複製時的通用性。曾考慮每種關聯一張具名 collection(可讀性與索引更好),折衷採單表 + 四條護欄:

- `relationType` 是程式碼中的封閉 enum,**完整清單**:`org_user`(使用者屬於組織)、`org_role`(角色的擁有組織)、`user_role`(角色授予)、`role_module`(角色綁模組 = 可進入的頁面)、`role_permission`(角色綁權限)。命名順序固定為 `Org > User > Role > Module > Permission`(如 `org_user`)
- **不在此表的**:權限→模組是唯一且不變的從屬,用 `permissions.moduleId` 直接欄位 — 原則:會增刪的多對多用關聯,固定從屬用欄位。`org_role` 雖也唯一,但保留關聯彈性(未來可能解綁),維持在本表
- 一律用二元關聯組合表達,不建三元關聯:每個角色只屬一個組織,查 `user_role` 就能知道這筆授予來自哪個組織的角色,無需 `org_user_role`;`thirdId` 欄位保留於 schema 但不使用,待未來出現真正不可分解的三元語義再啟用
- 唯一複合索引 `(relationType, firstId, secondId, thirdId)` 防重;`org_role` 另在 role 側建唯一索引(一個角色僅一個擁有組織)
- `meta` 物件欄位承載關聯自身資訊(授權人、時間等)
- 僅允許經泛型 RelationService 的具名包裝(如 `assignRoleToUser`)存取,禁止裸查

其他業務域(如食譜)的關聯不進此表,各自建具名關聯。
