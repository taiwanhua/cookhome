# 前端程式碼風格與分層(admin / front / ui 共用)

第 2 段結束後(2026-09-19)對 admin 程式碼的一次風格定案。這些規則主要給產碼的 agent 用:寫在前面,第 3 段起的程式碼就照這套長;既有程式碼由三張重構票(#116 admin、#117 ui、#118 front)一次轉換。條文寫在規範檔(GEN-01、STRUCT-03、REACT-01 / 02 / 06 / 07),本文只記**決定與理由**。

## 決定

| #   | 決定                                                                                                                  | 取代                                        |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | 跨元件的用戶端狀態一律 **zustand**;context 只剩注入用(theme、QueryClient、Intl provider)                              | REACT-02「全域 store 禁止」、手刻外部 store |
| 2   | 檔名依內容分三種:元件 `.tsx` **PascalCase**、hook `useXxx.ts` **camelCase**、其餘 **kebab-case**                      | GEN-01 全 kebab + `index.tsx` 入口          |
| 3   | **一檔一元件**;有子元件才開同名資料夾,子元件放在唯一使用它的父元件底下;**不用 `index.ts` barrel**,import 寫到檔案     | 一檔多元件、資料夾 + index 入口             |
| 4   | 元件、hook、一般函式一律**箭頭函數**;props 用 `export interface XxxProps` 獨立宣告,參數不包 `Readonly`                | REACT-01 function 宣告 + `Readonly<>`       |
| 5   | app 內分層 `app / pages / components / hooks / stores / lib / test`,**import 只能往下**;`pages/` 的樹照側欄(= 路由)長 | STRUCT-03 的 `features/`                    |
| 6   | 單檔以 **300 行**為目標,超過就拆子元件 / hook / 純函式;lint 硬上限 400                                                | 無                                          |
| 7   | 三個前端包(admin、front、ui)同一套;框架強制的例外只有 Next.js `app/` 路由檔與 ui 的 story 三件套                      | 各包各自慣例                                |

## 理由

- **zustand 而不是 context / 自刻 store**:第 2 段已經出現一份手刻的 `createRouteTabsStore` + `useSyncExternalStore` + sessionStorage 同步(207 行),本質上就是在重做 zustand;`LocaleContext`、session context 也各自處理訂閱與同步。統一成 zustand 後「跨元件狀態」只有一種寫法,agent 不用每次選。伺服器資料仍然只走 TanStack Query,URL 能表達的仍然放 URL,這兩條不變。
- **PascalCase 元件檔、一檔一元件**:檔名 = 元件名,搜尋、跳轉、review 都直接;一檔多元件(`side-nav.tsx` 四個)讓 300 行很快被撐破,而且看不出哪個是對外的。
- **不用 index.ts**:好處只有路徑短;代價是每個元件多一檔、barrel 對 Vite HMR 與 tree-shaking 不利、容易產生循環 import,而且 agent 常把子元件也順手匯出,封裝反而破掉。「子元件只給父用」改由資料夾位置與 review 表達。
- **`pages/` 取代 `features/`**:bulletproof-react 的 feature 是「照業務能力切」,但 admin 早有一個更精確的業務單位,就是**模組**(側欄的每一項、有權限 key 的東西),「一個頁面 = 一個模組」已是產品定義;再套一層沒定義的 feature,結果是什麼都往裡塞(auth、shell、overview 全在 `features/`)。`pages/` 照側欄樹長,路徑就是路由,找頁面不用想。
- **殼放 `app/`**:AdminShell 不是頁面(沒有路由,包住所有頁面),唯一使用者是 `routes.tsx`;照「元件放在唯一使用它的那層」它就是組裝層的一部分。`app/` 的定義:不含業務內容、只負責把頁面接上路由、守衛、版面與 providers。
- **箭頭函數 + props export**:一致性優先;props interface 對外可見,頁面組合子元件時能直接引用型別,不用 `ComponentProps<typeof X>` 繞。
- **300 行是目標不是門檻**:301 行不算違規,重點是元件切得合理;400 行由 lint 擋是為了讓 agent 不會交出 600 行的檔。

## 後果

- 規範改寫:GEN-01、STRUCT-03、REACT-01 / 02 / 06,新增 REACT-07;README 索引加列。
- lint 規則集中在 `@repo/eslint-config/frontend-style`(檔名三條、箭頭函數、import 方向、max-lines 400),**各包完成重構的那個 PR 才把它加進自己的 `eslint.config`**;沒加之前既有程式碼不會紅,新程式碼靠規範與 review。
- 既有程式碼由 #116 / #117 / #118 轉換,不改行為、測試沿用。轉換完成前,規範檔的「現況註記」說明新舊並存的處理方式。
- CONTEXT.md 不需新詞;「模組 = 頁面」沿用 ADR-0004。
