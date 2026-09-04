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
  **進度(2026-09-04):①②③⑤ 已完成** — `www.cookhome.online`(Vercel front,裸網域 308 轉 www)、`erp.cookhome.online`(admin)、`api.cookhome.online`(api)全數上線,憑證自動簽發;GraphQL Sandbox 以 `GRAPHQL_SANDBOX` env 控制,雲端預設關。剩 ④(deploy.yml + WIF)與 Environments 核准閘門。原記錄:①②③ 已完成 — image 在 Artifact Registry(asia-east1/cookhome,tag=git SHA);admin、api 已上 Cloud Run(min=0/max=2);Atlas `cookhome-dev` 已接(URI 走 Secret Manager,Network Access 0.0.0.0/0);端到端驗證通過。待辦追加:固定出口 IP(VPC connector + NAT,~US$10/月)與 Cloudflare 橙雲(需 Global LB)先不做;Cloudflare 已接管 DNS,紀錄於 ⑤ 設定。

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

5. **設計系統收尾** — `react/styling.md` 規範、apps 禁直接 import `@mui/material` 的 lint 規則、Storybook 部署(建議 Vercel 第二專案)、figma-generate-library 投影(品牌 = Figma variable mode)、自訂 `/to-figma` skill。
6. **staging api 環境時機** — 初期單環境是否足夠。
7. **i18n 方案** — front(next-intl?)與 admin 的多國語系;設計系統已配合(元件不寫死文案)。
8. **Budget 終極斷路器** — Pub/Sub + Cloud Function 自動解綁 billing;看過前幾個月帳單再決定。
9. **AI 自動 PR review 時機** — GitHub Actions 上的 AI review 與本地 `/code-review` 的分工。
10. **Turbo remote cache** — 等 CI 時間變長再評估。

### C. 外部條件觸發(追蹤中)

11. **unicorn 升級** — 等 ESLint 10 生態穩定,連 ESLint 一起升。
12. **api 錯誤處理總策略 / module 邊界細則** — 等 api 長出第二個 feature 再歸納(見 standards README)。

---

## 三、建議的進行順序

A1(commit)→ A2(hooks)→ A3(ci.yml)→ B4(front build 策略,ci.yml 需要它)→ B5(設計系統收尾)→ GCP 學習路線(一、4)→ 其餘看時機。
