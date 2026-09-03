> 📁 歷史存檔(2026-08):討論過程的原始筆記,內容已全部整理進 `docs/tmp/dis.md` 與 `docs/architecture.md`,僅供追溯。

我接下來，要嘗試使用 ai 搭建整個食譜專案，

專案架構上，
我想要使用 turboRepos 做 monorepos

npx create-turbo@latest -e kitchen-sink

應該會建出這幾個 app，我希望他們分別做為以下用途:

api: 後端 API server，front admin 都會打這個服務
storefront: 專案前台前端，幫我改名為 front，相關配置也幫我改正確，之後不會使用 API Routes
admin: 後台前端
blog: 我不需要這個請幫我刪除

還會建出這幾個 package :

@repo/eslint-config
@repo/jest-presets
@repo/logger
@repo/ui
@repo/typescript-config

接下來，幫我調整後端 api 的架構:

使用 nestjs 框架 Express and Apollo (npm i @nestjs/graphql @nestjs/apollo @apollo/server @as-integrations/express5 graphql)
並且使用 Prisma ORM v6.19，與 MongoDB，
記得要搭配 @graphql-codegen 與 @graphql-codegen/typescript-react-query 來生成前端的 typescript hooks，方便前端使用。

在幫我調整前端的 storefront 與 admin 套件架構:

要搭配 graphql-request 與 TanStack Query 使用

---

接下來，我希望搭建有AI的工作流程，
你能建議我要怎麼樣搭建嗎?
例如:
需求釐清與確認產出plan、figma > 開始製作，製作為了確保產出質量，要如何規定AI按照我的規範下去產生程式碼 > 測試與人工驗收 > CICD 與 release
有任何更好的建議嗎?

我現在在查相關資料，例如是不是可以搭配 vercel-labs/agent-skills/react-best-practices + 自訂義規則 確保前端產出質量、 web-design-guidelines 檢查UIUX、writing-guidelines 檢查文件質量

---

> > > > > > ---

https://github.com/vercel-labs/agent-skills

react-best-practices + 自訂義 確保前端產出質量
web-design-guidelines 檢查UIUX
writing-guidelines 檢查文件質量

https://github.com/mattpocock/skills

Playwright E2E

三層約束

1. 能自動化的 → 放進工具：ESLint（含自訂 rule）、TypeScript strict、Prettier/Biome。再配合 Claude Code 的 hooks，每次 AI 編輯完檔案自動跑 lint/typecheck，錯了當場被擋、當場修，而不是等到 review 才發現。
2. 不能自動化但可逐條檢查的 → 放進 review skill 的 checklist：你提到的 vercel-labs/react-best-practices 就屬於這層（它本質是幾十條可檢查的規則），web-design-guidelines 也是。自訂規範也做成同樣格式的 skill。
3. 原則性、方向性的 → 放 CLAUDE.md：保持短而高訊號，只放「這個 repo 特有、AI 猜不到」的東西。

---

CI 實際流程與 GitHub Actions 費用

「本地和 CI 同一套」的具體做法是:兩邊跑同樣的 npm scripts,你已經有了(pnpm lint / check-types / test / build,都走 turbo)。流程長這樣:

1. 編輯當下(最快回饋):Claude Code hook,AI 每次改完檔案自動對該檔跑 eslint + tsc,錯了立刻擋回去修。
2. commit 前(可選):husky + lint-staged 跑 staged 檔案的 lint/format。
3. PR 時(權威關卡):GitHub Actions workflow:pnpm install → turbo run lint check-types test build。Turbo 的快取讓沒動到的 package 直接跳過,一般幾分鐘內跑完。再開 branch protection,要求這個 check 綠了才能 merge——AI 和人走同一道門。

> > > > > ---

cookhome 我在另外一個 session 讀 docs\tmp\init.md 把專案基本樣子建起來了，
你可以看一下，但是我覺得並沒有按找我想要的約束去寫程式碼，所以現在要補上，
我同意你說的分成三層

1. 能自動化的 → 放進工具：ESLint（含自訂 rule）、TypeScript strict、Prettier/Biome。再配合 Claude Code 的 hooks，每次 AI 編輯完檔案自動跑 lint/typecheck，錯了當場被擋、當場修，而不是等到 review 才發現。
2. 不能自動化但可逐條檢查的 → 放進 review skill 的 checklist：你提到的 vercel-labs/react-best-practices 就屬於這層（它本質是幾十條可檢查的規則），web-design-guidelines 也是。自訂規範也做成同樣格式的 skill。
3. 原則性、方向性的 → 放 CLAUDE.md：保持短而高訊號，只放「這個 repo 特有、AI 猜不到」的東西。

需求釐清的部分，我也同意，但能夠在 /to-spec 產出規格時也產出 figma 設計稿，可能要有一個新 skill /to-figma ? 最後在執行產出程式碼時就照 figma 上的樣子去產出，這裡其實還帶出一個問題，我該怎麼為每個專案設計一個樣式風格，以便在後續每個 ticket 使用?

再來，小步快跑我覺得很好，TDD的話 我想知道，前端組件是如何測試?如果只是util 或後端api函數 我還能理解，但 react component 要怎麼 TDD ?

/code-review 是否適用我們一開始討論的三層約束，感覺應該要是能夠重用的一套規定? 並在這些規定之上，給出更好的建議? 接著再考慮將這個建議做採用，但這個部分要怎麼收集新建議，是從 github PR 的 review 上收集嗎? 那若是在本地跑 review 又該如何收集，假設有其他人餐與開發? 另外人工驗證的話，admin 專案要怎麼驗證，也沒有 preview URL ? preview URL是免費的嗎?

CI 跑的檢查必須和本地 hooks 完全同一套 我也同意，我想知道實際的流程，另外 GitHub Action 要錢嗎?

---

TDD 是指完全不寫組件或函數，直接寫測試嗎?這樣怎麼寫?連命名 input output 都不知道?
vercel 也有GKE那樣的欉集嗎? 能夠隨時調整POD的數量嗎? 若流量太大資源不夠能夠自己增加POD嗎?
github 能做CD嗎? 像argoCD 那樣的 CD 流程?

---

TDD 我明白了，之後再看AI產出的內容。

如果 front admin api 都放 GOOGLE Cloud Run， 資料庫放 MongoDB Atlas 可以嗎? 有什麼缺點嗎?會網站效率很差嗎?

我以為 build 是 CI 的一部分耶? 拿image deploy 才是 CD? GitHub Actions CI CD 實際的話要怎麼做，要怎麼搭配 GOOGLE Cloud Run ? 而且那你到時候能一步一步引導我設定嗎? 我想順便學習

---

那這樣吧，front 放 vercel，admin api 都放 GOOGLE Cloud Run，
另外一問 admin api放同一個 Cloud Run 還是要分開放?優缺點是甚麼?

---

自訂規範 docs/standards/ 可以分資料夾嗎 react 自己一個資料夾 其他也有自己的資料夾?
往域剛剛買了是: cookhome.online

你有辦法 用 figma-generate-library 幫我設計一套基於 MUI 顏色主色是 #fb7b10 的設計系統嗎?

---

但包出第一批元件前，是不是應該要先訂產出的程式碼風格與規定，
首先要先幫我配置 @trivago/prettier-plugin-sort-imports 我希望 import 的順序全部統一，
再來是寫組件的方式，與 code style
但在定這些之前 我是不是應該要先 Run /setup-matt-pocock-skills ，然後才開始寫約束的分層?
接著有了這些約束再開始配置 MUI 定義 MUI theme 並產出程式碼並執行 執行 figma-generate-library?

另外我想問為什麼 mattpocock 是透過 claude plugins install mattpocock-skills 但 vercel 是 npx skills add vercel-labs/agent-skills 的安裝方式?他們都是 claude plugin 嗎?
