# 權限查詢與判斷流程:從登入到畫面渲染的完整鏈路

本文把「查什麼表、組什麼結構、在哪裡判斷」一步步寫死,作為前後端實作與共識的唯一依據。

## 資料來源(誰決定什麼)

| 資料 | 決定什麼 |
|---|---|
| `role_module`(核心關聯) | 角色綁模組 — **進得去哪些頁**(模組=頁面) |
| `role_permission`(核心關聯) | 角色綁權限 — **頁面裡什麼能用**(權限=按鈕/欄位/跳窗/flag) |
| `permissions.moduleId`(直接欄位) | 每筆權限屬於哪個模組(唯一從屬) |
| `data_scope_rules` | 查資料時**看得到哪些**(ADR-0008) |

## 登入後的查詢步驟(API 組「模組陣列」)

1. 驗 token,取 userId 與當前組織
2. `user_role`:查此人的角色 → roleIds
3. `role_module`:roleIds → moduleIds(樹必然完整 — 權限矩陣 UI 強制「勾下層必勾上層」)
4. `role_permission`:roleIds → permissionIds → 查 permissions(每筆自帶 moduleId、key)
5. wildcard 展開:key 以 `.*` 結尾者 → **該模組自己這一層**(moduleId 等於它)的全部權限視為持有,不含子模組(同層語意,ADR-0004;`role_permission` 對該模組只存 `*` 一筆)
6. 組陣列:查 modules(_id ∈ moduleIds;enabled=false 者連子樹剔除)→ 每個模組物件塞 `permissions` = 有效權限中 moduleId 等於它的那些
7. 回傳**模組陣列**,每筆含:parentId、sidebarType、route、permissions

## 前端判斷

- **側欄**:以 parentId 組樹;sidebarType 決定呈現(group=可展開群組、link=連結、hidden=不顯示)
- **路由防守**:每個模組的 route 與上層 route 組合 → 「可進入路由集合」;手打網址不在集合內 → 擋。**可進 = 有那個模組路由**,僅此一條
- **頁內功能**:登入時把模組陣列組成全域權限結構(模組 key + 動作 = 完整權限 key),放全域快取(react-query/全域 state),所有頁面共用;判斷 = 「key 在集合中,或該權限的擁有模組 key + `.*` 在集合中」(一次查表,不掃前綴)
- **key 切分共識**:最後一段 = 權限動作(恆為單段;`*` 是唯一特殊動作),其餘 = 擁有模組 key(= 路由層級累加)。歸屬的真相仍以 `moduleId` 欄位為準,切字串僅供人讀與前端組 key

## API 防守

- controller 標註所需權限 key(重用頁面權限 key,ADR-0004);後端同樣以「聯集 + 擁有模組的 `*`」判斷
- 資料查詢一律經 BaseRepository:租戶隔離保底 + 資料範圍規則(ADR-0008)

## 快取

- 後端 v1 不快取,每次現查(單一入口 PermissionResolver,ADR-0003)
- 前端以 react-query 快取模組陣列;角色/授權異動後重新登入或重新整理取得新結構(主動失效未來再加)
