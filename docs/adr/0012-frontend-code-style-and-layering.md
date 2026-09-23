# 前端程式碼風格與分層(admin / front / ui 共用)

> 現況說明見 `docs/concepts/frontend-architecture.md`。條文寫在規範檔(GEN-01、STRUCT-03、REACT-01 / 02 / 06 / 07),本文只記決定與理由。

## 決定

| #   | 決定                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | 跨元件的用戶端狀態一律 **zustand**;context 只剩注入用(theme、QueryClient、Intl provider)                              |
| 2   | 檔名依內容分三種:元件 `.tsx` **PascalCase**、hook `useXxx.ts` **camelCase**、其餘 **kebab-case**                      |
| 3   | **一檔一元件**;有子元件才開同名資料夾,子元件放在唯一使用它的父元件底下;**不用 `index.ts` barrel**,import 寫到檔案     |
| 4   | 元件、hook、一般函式一律**箭頭函數**;props 用 `export interface XxxProps` 獨立宣告,參數不包 `Readonly`                |
| 5   | app 內分層 `app / pages / components / hooks / stores / lib / test`,**import 只能往下**;`pages/` 的樹照側欄(= 路由)長 |
| 6   | 單檔以 **300 行**為目標,超過就拆子元件 / hook / 純函式;lint 硬上限 400                                                |
| 7   | 三個前端包(admin、front、ui)同一套;框架強制的例外只有 Next.js `app/` 路由檔與 ui 的 story 三件套                      |

## 理由

- **zustand 而不是 context / 自刻 store**:手刻外部 store + `useSyncExternalStore` + sessionStorage 同步,本質上就是在重做 zustand;統一後「跨元件狀態」只有一種寫法,agent 不用每次選。伺服器資料仍只走 TanStack Query,URL 能表達的仍放 URL。操作結果提示(Snackbar)的狀態同樣走 store,不走 context。
- **PascalCase 元件檔、一檔一元件**:檔名 = 元件名,搜尋、跳轉、review 都直接;一檔多元件讓 300 行很快被撐破,也看不出哪個是對外的。
- **不用 index.ts**:好處只有路徑短;代價是每個元件多一檔、barrel 對 Vite HMR 與 tree-shaking 不利、容易循環 import,而且 agent 常把子元件順手匯出,封裝反而破掉。
- **`pages/` 取代 `features/`**:admin 已有更精確的業務單位 —— **模組**(一個頁面 = 一個模組);再套一層沒定義的 feature,結果什麼都往裡塞。`pages/` 照側欄樹長,路徑就是路由。
- **殼放 `app/`**:AdminShell 沒有路由、包住所有頁面,唯一使用者是 `routes.tsx`;`app/` 的定義是「不含業務內容,只負責把頁面接上路由、守衛、版面與 providers」。
- **箭頭函數 + props export**:一致性優先;頁面組合子元件時能直接引用 props 型別。
- **300 行是目標不是門檻**:重點是元件切得合理;400 行由 lint 擋,讓 agent 不會交出 600 行的檔。

## 影響

- lint 規則集中在 `@repo/eslint-config/frontend-style`(檔名三條、箭頭函數、import 方向、max-lines 400),各包在自己的 `eslint.config` 啟用。
- CONTEXT.md 不需新詞;「模組 = 頁面」沿用 ADR-0004。
