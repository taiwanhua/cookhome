# CookHome 程式碼規範索引

本資料夾是三層約束中的第二層「可審查的檢查清單」:放 **lint 管不到、但 CookHome 已做出決定** 的規範。
通用最佳實踐不放這裡 — 那是 vercel-labs skills(`react-best-practices`、`web-design-guidelines`、`writing-guidelines`)的職責。

## 怎麼用(給 AI 與人)

- **產碼前**:依下表載入與改動範圍相關的檔案,只載需要的,不要全部吞。
- **review 時**:引用規則編號(例:「違反 REACT-02」),不要只說「不符規範」。
- **回饋循環**:review 中被採納的新決定,回寫到對應檔案成為新規則(沿用編號流水號);規則被推翻時修改該條並在行尾註記日期,不留殭屍規則。

## 索引

| 改動範圍                                            | 必讀                                                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 任何程式碼                                          | `general/naming.md`、`general/structure.md`                                                                            |
| 前端檔名 / 資料夾分層 / 元件寫法(admin、front、ui)  | `general/naming.md` GEN-01、`general/structure.md` STRUCT-03、`react/components.md` REACT-01 / 02 / 07;決策見 ADR-0012 |
| React 元件(front / admin / ui)                      | `react/components.md`、`react/styling.md`、`general/figma.md`(設計稿對照)                                              |
| 新增 `@repo/ui` 元件 / 子路徑匯出                   | `general/structure.md` STRUCT-08 的四處清單、`general/naming.md` GEN-01、`react/styling.md` STYLE-05 / 07              |
| 前端資料存取(query / mutation)                      | `react/data-fetching.md`                                                                                               |
| api 的 GraphQL schema(resolver / model / input)     | `api/graphql-schema.md`                                                                                                |
| 測試                                                | `testing/testing.md`(api 整合測試 TEST-07、admin 元件測試 TEST-08)                                                     |
| 新增 workspace 套件(`packages/<name>`)              | `general/structure.md` STRUCT-07 / STRUCT-08                                                                           |
| 新增 app workspace(`apps/<name>`)                   | `general/structure.md` STRUCT-08 的「新增一個 app workspace」與「build 時烘進產物的變數」兩節                          |
| CLI 工具 / `apps/db-migrator`(seed、migrate、reset) | `general/structure.md` STRUCT-06(輸出用 `process.stdout.write`)/ STRUCT-05 的已知誤判 / STRUCT-10;規則本體見 ADR-0002  |
| UI 文案 / 多語(i18n)                                | `general/i18n.md`                                                                                                      |
| Figma 設計稿                                        | `general/figma.md`                                                                                                     |
| Markdown 文件(docs/、help.md、README)               | `general/structure.md` STRUCT-09                                                                                       |

## 尚未定案(刻意不寫)

- 錯誤處理總策略、api 的 module 邊界細則 — 等 api 長出第二個 feature 再歸納。

空規範比沒規範糟;沒把握的決定不要先寫進來。
