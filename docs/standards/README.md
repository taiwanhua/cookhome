# CookHome 程式碼規範索引

本資料夾是三層約束中的第二層「可審查的檢查清單」:放 **lint 管不到、但 CookHome 已做出決定** 的規範。
通用最佳實踐不放這裡 — 那是 vercel-labs skills(`react-best-practices`、`web-design-guidelines`、`writing-guidelines`)的職責。

## 怎麼用(給 AI 與人)

- **產碼前**:依下表載入與改動範圍相關的檔案,只載需要的,不要全部吞。
- **review 時**:引用規則編號(例:「違反 REACT-02」),不要只說「不符規範」。
- **回饋循環**:review 中被採納的新決定,回寫到對應檔案成為新規則(沿用編號流水號);規則被推翻時修改該條並在行尾註記日期,不留殭屍規則。

## 索引

| 改動範圍                                        | 必讀                                        |
| ----------------------------------------------- | ------------------------------------------- |
| 任何程式碼                                      | `general/naming.md`、`general/structure.md` |
| React 元件(front / admin / ui)                  | `react/components.md`                       |
| 前端資料存取(query / mutation)                  | `react/data-fetching.md`                    |
| api 的 GraphQL schema(resolver / model / input) | `api/graphql-schema.md`                     |
| 測試                                            | `testing/testing.md`                        |
| UI 文案 / 多語(i18n)                            | `general/i18n.md`                           |

## 尚未定案(刻意不寫)

- `react/styling.md` — 等設計系統(design tokens + MUI theme)定案後建立。
- 錯誤處理總策略、api 的 module 邊界細則 — 等 api 長出第二個 feature 再歸納。

空規範比沒規範糟;沒把握的決定不要先寫進來。
