# 表單引擎(現況說明)

回答「欄位由使用者在後台自己設計的模組怎麼運作」:骨架誰建、表單誰管、版本怎麼走、提交怎麼存、欄位級權限怎麼套、前端怎麼組裝。api 的落地細節(四步發布、寫入規則、投影、lookup 登錄表、錯誤碼)在 `docs/modules/forms.md`;資料表見 `docs/data-model.md`。與固定欄位模組(示範模組那種,`docs/agents/module-scaffold.md`)兩條路並存。

## 骨架 vs 表單

| 部分                                                   | 誰建 / 誰管            | 在哪                                                                 |
| ------------------------------------------------------ | ---------------------- | -------------------------------------------------------------------- |
| 模組骨架:路由、三個 `-page` 隱藏頁、四筆權限、資料目標 | 開發者(seed)           | `apps/db-migrator/seeds/modules/<模組>.ts`,節點宣告 `engine: "form"` |
| 表單:欄位、版面、版本、摘要槽、帶入規則                | 平台(共用)/ 租戶(客製) | 「表單管理」頁(`system.forms`)                                       |
| 分派 / 啟用                                            | 平台分派、租戶開關     | 業務關聯 `org_form`                                                  |
| 提交(使用者填的資料)                                   | 使用者                 | `form_submissions`(所有表單模組共用,`moduleKey` 區分)                |

- 沒有模組節點,表單無處可掛、權限無處可綁;所以模組永遠由 seed 建,表單才是執行期的。
- 一張表單只屬一個模組;要在別的模組用,以它為基底建新表單。

正本:`apps/db-migrator/seeds/modules/shopping-list.ts`(範例)、`apps/api/src/forms/`

## 表單的三種身分與可新增的交集

- **共用表單**(`ownerOrgId = null`):只有站在根組織的人能建、改、分派。
- **客製表單**:租戶以分派來的某一版為基底建的(`forkedFrom`),只有該租戶看得到(平台也看不到)。
- 表單 key 全域唯一、**建立後不可改**(格式 `^[a-z][a-z0-9_]{0,39}$`,不准 `.` 與 `-`,欄位級權限 key 才能唯一拆回)。

某租戶在模組 M **此刻能新增**的表單 = 本租戶 `org_form` 啟用中 ∩ 掛在 M ∩ 有發布版本(`moduleForms`)。一張 → 新增直接進;多張 → 先選。

| 停止新增的方式 | 誰         | 設計端            | 新增                    | 歷史提交           |
| -------------- | ---------- | ----------------- | ----------------------- | ------------------ |
| 租戶停用       | 租戶管理員 | 仍列出,標停用     | 不可                    | 有模組 view 照常看 |
| 收回分派       | 平台       | 不再列            | 不可                    | 照常看             |
| 退役目前版本   | 表單擁有者 | 仍列出,無發布版本 | 所有租戶不可,直到再發布 | 照常看             |

正本:`apps/api/src/forms/form-access.service.ts`

## 版本生命週期

```
草稿 ──發布(changelog 必填)──▶ 發布中 ──▶ 已發布 ──(下一版發布 / 退役目前版本)──▶ 已退役
  ▲                                                                         │
  └──────────── 以任一版本為基底開新草稿(同時最多一份草稿) ◀─────────────┘
```

- 存草稿與發布都帶「讀到的草稿修訂號」,不符 → 「已被別人更新,請重新載入」。
- 發布四步、不用交易:檢查器 → 搶鎖配版號 → 欄位級權限建 / 復活 / 退役 → 三筆逐筆切換。中斷時版本面板顯示「重試」,從第三步冪等重跑。
- 檢查器(`validateDefinition`)前後端同一份;正則的 ReDoS 檢查(recheck)在獨立子路徑 `@repo/domain/form-regex-safety`,由呼叫端注入(api 直接用,admin 設計器懶載入,不進首屏 bundle)。

正本:`apps/api/src/forms/form-design/form-publish.service.ts`、`packages/domain/src/form/validate-definition.ts`

## 提交

| 狀態   | 可做什麼                                                          |
| ------ | ----------------------------------------------------------------- |
| 草稿   | 只屬於建立者;可改可刪;只驗型別(守門照常)                          |
| 已完成 | 送出即完成;可再改(模組 edit + 這一筆的 canEdit),每改一次修訂號 +1 |

- 新增 = 先建草稿(頁面開啟時產生的 `clientRequestId`,重試回同一筆)再送出;畫面上一顆「送出」就是這兩步。
- 每次寫入帶 `expectedEditVersion`(已完成修改另帶 `expectedRevision`),不符 → 請重新載入。
- 每個修訂號留**完整值快照** + `ctx`(時間、時區、操作者、當時組織);差異在讀取時由相鄰兩筆算。詳情以該修訂的 `ctx` 重算顯示 / 唯讀條件,**不重算、不清空存值**,不拿讀者現在的身分補值。
- 值依型別存(選項 `{ value, label }`、引用 `{ id, label }`、上傳 `{ path, name, size, contentType }`、數字十進位字串);表達式看到的是語意值(選項的 value、引用的 id)。

## 欄位級權限與受保護依賴鏈

- 欄位設 `permission.show` / `edit` → 發布時在該模組下建動態權限 `<模組>.show-<formKey>-<fieldKey>` / `edit-…`(`permissions.source = "dynamic"`,`name` 隨欄位 label 更新);不再宣告的標 `retiredAt`,由「模組與權限」的退役權限清理刪除(三層檢查)。
- 看不到的欄位 api 回 `"[redacted]"`;畫面以欄位級三態呈現:看不到 → 不渲染,看得到改不了 → 唯讀附說明,都有 → 可填。
- 計算欄位沿依賴鏈繼承保護:讀得到 = 自己的 show(若設)且依賴鏈上每個受保護欄位的 show。
- 不能填的四種原因,後端依序判:顯示條件為假(清空)→ 計算 / 固定值(後端算)→ 沒有欄位級 edit(保留既有值,送不同值整筆 403)→ 唯讀條件(保留既有值)。條件一律以後端算的為準。

正本:`packages/domain/src/form/dependencies.ts`、`apps/api/src/forms/form-values/submission-values.service.ts`、`apps/api/src/forms/field-permission-gate.ts`

## 前端:引擎零件與預設組裝

表單引擎是一組零件,不是固定頁面。`app/module-pages.tsx` 登記方式不變(模組 key → 頁面元件),引擎提供 `formModulePages(moduleKey)` 產出四個 key 的預設元件:

```ts
...formModulePages(SHOPPING_LIST_MODULE_KEY),                        // 四頁全用預設
...formModulePages(LEAVE_KEY), [LEAVE_KEY]: LeavePage,               // 列表頁客製、其餘預設
[LEAVE_KEY]: LeavePage, [`${LEAVE_KEY}.view-page`]: LeaveViewPage,   // 全部自己來
```

| 零件                                                    | 做什麼                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `FormRenderer`(`version` / `values` / `mode`)           | 依版本畫表單;`mode` = `create` / `edit` / `readonly` / `design` / `preview`     |
| `FormSubmissionList`                                    | 提交列表(`DataTable`),欄來自列表欄位配置;引用那一筆版本沒有的欄位顯示「—」      |
| `FormSubmissionDetail`                                  | 詳情:唯讀渲染、現名 / 快照、附件下載、修訂紀錄與差異                            |
| `FormPicker` / `LookupDialog` / `ReferenceField`        | 選表單 / 帶入資料跳窗 / 引用欄位的搜尋選擇器                                    |
| `useModuleForms` / `useFormDraft` / `useFormSubmission` | 可新增的表單 / 建草稿與送出 / 讀寫既有提交                                      |
| `renderValue(ctx)`                                      | 語意型別 → 畫面(REACT-13 簽章)                                                  |
| widget 登錄表                                           | `widget.kind` → 元件;擴充一個 widget = domain 型別登錄 + admin 元件登錄各加一筆 |

| `mode`            | 條件 / 計算                                | 權限         | 值     |
| ----------------- | ------------------------------------------ | ------------ | ------ |
| `design`          | 不跑,只標示(顯示條件、計算、受保護…)       | 不套         | 不輸入 |
| `preview`         | 跑(前端即時,另以後端 `previewFormVersion`) | 不套         | 測試值 |
| `create` / `edit` | 跑                                         | 套           | 真實值 |
| `readonly`        | 只重算顯示 / 唯讀條件(用該修訂的 `ctx`)    | 套(現在讀者) | 存值   |

頁籤 / 標題 = 模組層模板(預設 `{{title}}`)套摘要槽,表單的 `tabLabelTemplate` 可覆寫。

正本:`apps/admin/src/components/form-engine/`、`apps/admin/src/lib/form-engine/`、`apps/admin/src/hooks/useModuleForms.ts`、`useFormDraft.ts`、`useFormSubmission.ts`
