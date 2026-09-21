# 示範模組2(技術)

示範家族的**對照組** — 目的、家族模組樹、測試劇本見 [示範模組1](./demo.sub.sample-one.md)。本篇只寫差異。

## 與示範模組1 的差異

- 掛在示範群組(`demo`)直下,不經次群組 — 示範兩層結構。
- **不宣告 `dataScopeTarget`**:查詢僅受可見範圍保底,驗證資料範圍規則未介入時的行為(ADR-0008)。
- 無欄位級與頁面自有權限,只有基本四筆(view / create / edit / delete)加上每模組固定一筆 `*`(seed 自動產生)。

## 模組節點

| key                                                         | 名稱           | sidebarType  | 自有權限   |
| ----------------------------------------------------------- | -------------- | ------------ | ---------- |
| `demo.sample-two`                                           | 示範模組2      | link(列表頁) | 見下       |
| `demo.sample-two.view-page` / `.create-page` / `.edit-page` | 詳情/新增/編輯 | hidden       | 各自僅 `*` |

## 權限表

`demo.sample-two.*`、`.view`、`.create`、`.edit`、`.delete` 共 5 筆,全綁示範模組2(列表頁);語意與示範模組1 對應權限相同。

## 資料

**demo_items_two**:name、note、enabled + 基礎欄位(ADR-0007)。

## api 介面(#319)

程式正本 `apps/api/src/demo-items-two/`;形式見 GQL-02 / GQL-03,錯誤碼見 GQL-04。

| 端點                                        | 需要的權限             | 說明                                         |
| ------------------------------------------- | ---------------------- | -------------------------------------------- |
| `demoItemsTwo(input): DemoItemsTwoPayload!` | `demo.sample-two.view` | 清單;`{ items, totalCount, page, pageSize }` |
| `demoItemTwo(id): DemoItemTwoPayload!`      | `demo.sample-two.view` | 單筆;`{ item }`                              |
| `createDemoItemTwo(input)`                  | `.create`              | 回 `DemoItemTwoPayload`                      |
| `updateDemoItemTwo(input)`                  | `.edit`                | 回 `DemoItemTwoPayload`                      |
| `setDemoItemTwoEnabled(input)`              | `.edit`                | 回 `DemoItemTwoPayload`                      |
| `deleteDemoItemTwo(input)`                  | `.delete`              | 軟刪除;回 `DeleteDemoItemTwoPayload`         |

**為什麼停用 / 啟用守 `.edit` 而不是自己的 `toggle-enabled`**:對照組的權限表只有四筆,切啟用狀態就是「改這一筆」。治理模組(角色管理、欄位管理)另有 `toggle-enabled`,是因為那裡的停用會影響**別人的權限**、要能單獨授予 —— 業務資料沒有這個需求。六個端點只用到四個 key,本身就是「權限與端點不必一一對應」的示範。

**型別名帶模組前綴**:code-first 的型別名全 schema 唯一,`DeletePayload` 已被組織管理用掉,所以這裡是 `DeleteDemoItemTwoPayload`。

### 回傳欄位的語意(GQL-07 的正本)

`DemoItemTwo`:`id`、`name`、`note`、`enabled`、`createdBy`、`createdAt`、`updatedAt`、`abilities`。

- **`createdBy`**(`{ id, name }`,可為 `null`):建立者。**查不到使用者時整個欄位為 `null`** —— seed 的示範資料建立者是假 id(見下方「Seed 與環境」),已刪除的帳號同理。前端要能顯示「—」,不可假設一定有值。
- **`abilities`**(`{ canEdit, canDelete }`):這位操作者對這一筆能做什麼,**api 依權限算好、前端只讀不重算**。示範模組2 沒有種類規則也沒有欄位級權限,所以它等於「操作者有沒有 `.edit` / `.delete`」;前端顯示按鈕的條件就是 `item.abilities.canEdit`,不再與 `usePermissions` 相乘(與角色管理的 `Role.abilities` 同型,但那邊是兩者相乘 —— 差別在這裡的 abilities 已經**含**權限判斷)。
- `enabled` 為 `false` 的項目**照樣列出來**,只是標示為停用;真正消失的是刪除(軟刪除)。

### 缺席 / `null` 的語意(GQL-06)

| input 欄位                    | 缺席         | `null`           |
| ----------------------------- | ------------ | ---------------- |
| `DemoItemsTwoInput.keyword`   | 不篩         | 不篩             |
| `DemoItemsTwoInput.enabled`   | 啟用停用都列 | 啟用停用都列     |
| `CreateDemoItemTwoInput.note` | 沒有備註     | 沒有備註(同缺席) |
| `UpdateDemoItemTwoInput.name` | 不動         | 型別上不允許     |
| `UpdateDemoItemTwoInput.note` | **不動**     | **清空**         |

`keyword` 比對 `name` 與 `note`(不分大小寫的部分比對,regex 特殊字元當字面值);分頁 `page` 1 起算、`pageSize` 預設 20 上限 100;排序固定 `createdAt` 由新到舊。

### 錯誤

**不新增任何 code** —— 對照組只用得到三個通用碼,這本身就是示範:

| code                | 什麼情況                                                                                |
| ------------------- | --------------------------------------------------------------------------------------- |
| `FORBIDDEN`         | 缺該端點的權限(由 `@RequirePermission` 統一擋);無 `reason`                              |
| `NOT_FOUND`         | 可見範圍外、或已軟刪除的項目 —— 兩者同碼,不透露存在與否                                 |
| `VALIDATION_FAILED` | `name` 去頭尾空白後為空(`fields: ["name"]`)、`id` 不是合法的 ObjectId(`fields: ["id"]`) |

### 審計

`demo-item-two.create` / `.edit` / `.delete` / `.toggle-enabled`,`targetType` 一律 `demo_item_two`。

## Seed 與環境

模組與權限同示範模組1。help:`apps/admin/src/md/module-help/demo.sample-two.help.md`。

**示範資料**(#319,程式正本 `apps/db-migrator/seeds/demo-items.ts`):`demo_items_one` 與 `demo_items_two` 各 5 筆,以 `key` 冪等、全環境灌同一份(示範資料本來就是種子,ADR-0002)。內容:三個建立者、三種 `status`、三個分類(示範模組1)、各一筆初始停用。

只有 `enabled` 是「初始 seed 值的欄位」(改了不會被下次部署翻回去);**其餘欄位每次部署同步回宣告值** —— 示範資料被玩壞時會自動復原,這是刻意的。軟刪除掉的示範項目不會被種回來。

**兩個已知限制**(#319,做不到而不是忘了做):

1. **示範資料全部掛在根組織**,不是票上寫的「分布兩個租戶」:`orgs` 種子只有根組織一筆(ADR-0005),租戶是 root 在「開通租戶」建出來的、各環境 id 不同,seed 引用不到。跨租戶的差異(劇本 12 可見性開關)要在該環境用手動新增的資料驗。
2. **建立者是固定的假 id**:seed 只建 root 初始帳號,而那筆 `users` 沒有 `key` 欄位,`seedRef` 只以 `key` 解析(`apps/db-migrator/src/seed/seed-declaration.ts`)。用假 id 而不是 `null`,是為了讓「不同建立者」看得出差異,並讓劇本 2(規則「建立者 = 【操作者本人】」)有東西可以被濾掉 —— 示範資料一律屬於「別人」。代價是詳情頁的建立者顯示為空。
