# CookHome AI 開發工作流程 — 討論整理

> 最後更新:2026-09-03
> 專案現況與架構事實見 `docs/architecture.md`;程式碼規範見 `docs/standards/`。本文件只追蹤:已拍板的流程共識、與待討論事項。

---

## 一、已達成共識(依主題整理)

### 1. 三層約束模型 ✅ 已實作(2026-09-03)

1. **機器強制**:ESLint 積木式組合(typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`、import-x 含 `no-cycle`、unicorn、sonarjs、jsx-a11y、`no-console`)、TS 加開 `noUncheckedIndexedAccess` 等、Prettier 抽成 `@repo/prettier-config`(@trivago import 排序)。
2. **可審查清單**:`docs/standards/` 7 檔編號規則(GEN/STRUCT/REACT/DATA/GQL/TEST,附好壞範例)+ vercel-labs skills(`vercel-react-best-practices`、`web-design-guidelines`、`writing-guidelines`,裝在 `.agents/skills/`)。
3. **原則層**:`CLAUDE.md`(指向 standards 索引與 docs/agents/)。

回饋循環:review 採納的決定回寫規範檔(已實際運轉,例:GEN-06 套件命名)。

### 2. 需求 → 開發流程(Matt Pocock skills)

```
/grilling → /to-spec → /to-tickets(GitHub Issues)→ /triage → /tdd → /code-review(規範軸 + 規格軸)
```

- Issue tracker:GitHub Issues(taiwanhua/cookhome,`gh` CLI);triage 標籤五個預設值。設定在 `docs/agents/`。
- TDD:測行為不測外觀;AI 先寫測試 → 人審測試(= 驗收介面)→ 實作;E2E 刻意少。

### 3. 設計系統 ✅ 起手式完成(2026-09-03)

- 程式碼是唯一真實來源,Figma 是投影;風格走 Minimal 方向(MUI theme 客製,不買模板/Figma kit)。
- 已完成:兩層 tokens(品牌層可整包替換)、`createAppTheme`(cssVariables、light/dark)、`@repo/storybook`(stories 與元件同居於 ui)+ Palette Lab(貼主色即時預覽全元件)、第一批元件 Button/TextField/Card 三件套。
- 風格一致性機制:唯一供給(只准用 `@repo/ui`)+ 元件內只用語意 token + AI 產稿只從生成的 Figma 庫組裝。
- front 走 Figma 設計稿階段;admin 直接 spec → code。

### 4. CI/CD 與部署

- CI = 驗證 + 產 artifact(image 以 SHA 標記);CD = 拿同一 artifact 部署(build once, deploy many);本地 hooks 與 CI 同一套指令。
- GitHub Actions:`ci.yml`(PR + branch protection)、`deploy.yml`(merge main → Artifact Registry → Cloud Run staging;production 走 GitHub Environments 人工核准);認證用 Workload Identity Federation。
- 部署拓撲與費用控管(max-instances 天花板 + Budget 警告)見 `docs/architecture.md`。
- 網域已購(2026-07-31):`cookhome.online`;三個子網域共享 cookie domain,可用 cookie auth。
- 學習路線(先手動再自動化):① 各 app Dockerfile + 本地驗證 → ② GCP 專案 + 手動推 image + `gcloud run deploy` → ③ Atlas 接上 → ④ 寫成 deploy.yml + WIF → ⑤ Environments 核准 + ci.yml + branch protection。
  **進度(2026-09-04):①②③⑤ 已完成** — `www.cookhome.online`(Vercel front,裸網域 308 轉 www)、`erp.cookhome.online`(admin)、`api.cookhome.online`(api)全數上線,憑證自動簽發;GraphQL Sandbox 以 `GRAPHQL_SANDBOX` env 控制,雲端預設關。**④ 亦完成(deploy.yml + WIF)**:merge main 自動部署 dev(api-dev/admin-dev,獨立 db `cookhome-dev`、Sandbox 開);production 手動 workflow_dispatch(免費方案無 Environments 核准,等效替代);Budget NT$600 三段警告已設。學習路線全數完成,詳見 `docs/deployment.md`。 — image 在 Artifact Registry(asia-east1/cookhome,tag=git SHA);admin、api 已上 Cloud Run(min=0/max=2);Atlas `cookhome-dev` 已接(URI 走 Secret Manager,Network Access 0.0.0.0/0);端到端驗證通過。待辦追加:固定出口 IP(VPC connector + NAT,~US$10/月)與 Cloudflare 橙雲(需 Global LB)先不做;Cloudflare 已接管 DNS,紀錄於 ⑤ 設定。

### 5. 版本策略 ✅ 已統一(2026-09-03)

同一套件全 repo 同版本;裝套件前查 registry 不憑記憶。現況:React 19.2、MUI 9.4、Vite 8.2、Storybook 10.6、TS 5.9.3、ESLint 9.39;例外:unicorn 釘 65(等 ESLint 10 生態)。套件名一律 `@repo/` 前綴(GEN-06)。

---

## 二、待辦與待討論

### A. 已完成(2026-09-03)

1. ~~commit 整理~~ — 已拆成 5 個主題 commit(prettier / docs+standards / eslint / 設計系統 / 版本統一)。
2. ~~Claude Code hooks~~ — `.claude/settings.json` PostToolUse:編輯後自動 lint(該檔)+ typecheck(該套件),失敗 exit 2 回饋 AI 當場修;腳本 `scripts/claude-hooks/post-edit-check.mjs`,已實測觸發。
3. ~~ci.yml~~ — `.github/workflows/ci.yml`:PR 與 main push 觸發,MongoDB service + 起 api(front ISR 預渲染需要)→ `turbo run lint check-types test build`。首跑綠燈。**branch protection 不設**(私有 repo 免費方案不支援;決策 2026-09-03:純自律走 PR 流程,規則寫進 CLAUDE.md;之後想強制可升 Pro 或轉公開,隨時可補)。
4. ~~front build 依賴 api~~ — 定案「起 API」:CI 用 service container + 空 DB;Vercel 端 build 打正式 api(部署順序:api 先上)。

### B. 需要討論決策

5. **設計系統收尾** — 進行中(2026-09-05):~~styling.md 規範(STYLE-01~05)~~、~~apps 禁直接 import MUI 的 lint 牆(designSystemWall)~~、~~Storybook 部署~~(Vercel 第二專案 `cookhome-design` → design.cookhome.online,只建 main)。~~theme 補完~~(2026-09-05:OKLab 感知混色 + overrides 逃生口、info/success/warning/error 四組狀態色、z1~z24 + colored shadows、typography scale、styleOverrides 擴到 11 個元件;全部是主色的函數,Palette Lab 實測換色一行全自動重算)。~~figma-generate-library 投影~~ — **已完成(2026-09-05)**:Wowgo 團隊「[CookHome Design System](https://www.figma.com/design/SvnBvi8Opfj8daJAclOnWW)」— 4 collections(Brand mode=CookHome/Primitives/Color Light+Dark/Radius)65 變數(38 別名零斷鏈、全 scope、code syntax = `var(--mui-*)`)、15 effect styles、13 text styles、元件 Button(18 變體)/TextField(8)/Card/Link(含 TEXT 屬性,Card 內嵌 Button 實例)。限制:Code Connect 需 Org 方案(Wowgo 是 Pro)→ 以元件 description + Storybook 連結替代。已知發現:primary/main(#FB7B10)配白字對比 ~2.6:1 低於 WCAG AA(待討論,修要改 code)。剩:自訂 `/to-figma` skill。styling 選型定案:MUI + sx 一路走到底(否決全轉 Tailwind 與混用;Base UI + Tailwind 留給未來性質不同的新專案)。
6. ~~staging api 環境時機~~ — **已解決(2026-09-04)**:三環境分支模型落地,staging 環境(api/admin/front/db)全數上線。
7. ~~i18n 方案~~ — **已完成(2026-09-04)**:`@repo/i18n` 訊息檔套件(zh-TW/en);front 用 next-intl(`/` = zh-TW、`/en` 前綴,SSG×2 語言 + ISR,Next 16 改用 `proxy.ts`),admin 用 use-intl(語言切換 + localStorage,不進 URL);api 語言無關(錯誤走 code)。規範 `standards/general/i18n.md`(I18N-01~05)。內容資料(食譜)多語 = 未來 schema 設計問題,與 UI i18n 分開。
8. **Budget 終極斷路器** — Pub/Sub + Cloud Function 自動解綁 billing;看過前幾個月帳單再決定。
9. **AI 自動 PR review 時機** — GitHub Actions 上的 AI review 與本地 `/code-review` 的分工。
10. **Turbo remote cache** — 等 CI 時間變長再評估。
15. **admin shell 規格備忘(2026-09-05,設計稿已畫)** — 側欄:依 module 設定分層、群組可展開收合(Draft/NavGroup+NavItem)。**路由頁籤列**(AppBar 下方,Draft/RouteTab):使用者開過的路由生成 tab;以路由 id/名稱**去重**;點側欄選單 → 出現對應 tab 並切換;點 tab 切回該路由;鑽入詳情生成「模組 / 項目名」子 tab;tab 可關閉、可拖曳排序(實作用 **dnd-kit**);資料結構以路由紀錄 id 比對顯示。其餘:Customer 與 User 分表分模組、Customer 依業務邏輯關聯 Org;JWT/OAuth 與資料結構設計待 /domain-modeling。
16. **建模組 skill(module-scaffold,2026-09-05)** — 協助使用者建立新後台模組(Figma 畫面 + 之後的 code 鷹架)。**必問使用者的問題**:①模組中文命名(語系中文,避免 User/Org 這類英文;既定:組織管理/使用者管理/角色管理/模組與權限/字段管理)②掛在側欄哪個群組、共幾層(1~3 層,對應遞迴 module 樹)③要生成哪些頁(列表/編輯/詳情)④RouteTab 顯示名稱。Figma 端做法已定型:AdminSideNav/AdminAppBar 為元件,實例覆寫 Label 與 active 色、備用列 visible 開關增減項目;RouteTabs 也已元件化(AdminRouteTabs:8 個預埋槽,各頁開 visible/改 Label/swap Active — 「備用槽」模式繞過實例不能增減子節點的限制,側欄同理);RouteTab 有 Closable 開關(Dashboard 固定頁不可關)。Figma API 陷阱:遍歷實例隱藏子節點要先 `figma.skipInvisibleInstanceChildren = false`。與 /to-figma skill 合併設計。命名已定案(2026-09-05):總覽、欄位管理。**RWD 規則**:front 每頁三檔 artboard(1440/768/375,斷點值以 MUI 為準:768→md、375→xs;手機廣告 320×100、平板 728×90、桌面 970×90);admin 單檔 1440 + 表格橫向捲動;殼元件用 Device=Desktop/Mobile 變體(FrontAppBar 漢堡、FrontFooter 直排)。
17. **開發手冊 `docs/workflow.md`(2026-09-05,使用者:「我根本忘記它的存在」)** — 整理「什麼階段用什麼 skill」的流程總覽,讓工具不再被遺忘。素材:①mattpocock-skills 工程套件:`/domain-modeling`(術語+ADR)、`/grill-with-docs`(拷問需求)、`/to-spec`、`/to-tickets`、`/tdd`、`/implement`、`/code-review`、`/diagnosing-bugs`、`/codebase-design`、`/improve-codebase-architecture`、`/prototype`、`/research`、`/triage`、`/wayfinder` ②figma 套件:figma-use / generate-design / generate-library ③repo skills(symlink+skills-lock):vercel-react-best-practices、web-design-guidelines、writing-guidelines ④自訂(待建):/to-figma、module-scaffold、project-bootstrap。內容:標準功能流程圖(需求→/grill-with-docs→/domain-modeling→/to-spec→/to-tickets→設計稿→/tdd 實作→/code-review→PR→dev→staging→main)+ 每 skill 一句話用途 + 觸發時機表。
18. **專案模板 skill(project-bootstrap)** — 使用者還有兩個 front+admin+api 專案要開;以 cookhome 為基底,品牌落點已盤點成 `docs/branding.md`(2026-09-05),skill 化後帶參數(品牌名、網域、GCP 專案)自動替換 + 走 deployment.md 建基礎設施。時機:第二個專案要開時。

### C. 小任務(不需討論,找時間做)

11. ~~deploy.yml 的 dev/staging api_url 換自訂子網域~~ — **已完成(2026-09-05)**:PR #11~#13,dev/staging admin 已重部署並驗證 bundle 烘入 `api-dev` / `api-staging.cookhome.online`。
12. **Atlas 拆成三個 cluster** — 現為單 M0 三 db(共用 500 連線上限與資源);已定案要拆(2026-09-04),時機:production 有真實流量升 M10 時一併(production 獨立 cluster + 正名,dev/staging 留 M0),或先用三個 Atlas project 各一免費 M0。過渡加固已做:三環境 URI 皆設 `maxPoolSize=10`(理論上限 60 連線,遠低於 500)。

### D. 外部條件觸發(追蹤中)

13. **unicorn 升級** — 等 ESLint 10 生態穩定,連 ESLint 一起升。
14. **api 錯誤處理總策略 / module 邊界細則 + schema 演進規範(向後相容、破壞性變更配遷移腳本)** — 等 api 長出第二個 feature 再歸納。

---

## 三、建議的進行順序

基建全數完成。接下來:B5(設計系統收尾)→ 用完整工作流程(/grilling → /to-spec → tickets → TDD)開發第一個真功能 → 其餘看時機。
