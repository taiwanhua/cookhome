# CookHome AI 開發工作流程 — 討論整理

> 最後更新:2026-09-12
> 專案現況與架構事實見 `docs/architecture.md`;程式碼規範見 `docs/standards/`。本文件只追蹤:已拍板的流程共識、與待討論事項。編號被其他文件引用(如「dis.md #16」),**不要改號**。

---

## 一、已達成共識(依主題整理)

### 1. 三層約束模型 ✅ 已實作(2026-09-03)

- **機器強制**:ESLint 積木式組合(typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`、import-x 含 `no-cycle`、unicorn、sonarjs、jsx-a11y、`no-console`)、TS 加開 `noUncheckedIndexedAccess` 等、Prettier 抽成 `@repo/prettier-config`(@trivago import 排序)。
- **可審查清單**:`docs/standards/` 編號規則(GEN/STRUCT/REACT/DATA/GQL/TEST,附好壞範例)+ vercel-labs skills(裝在 `.agents/skills/`)。
- **原則層**:`CLAUDE.md`(指向 standards 索引與 docs/agents/)。
- 回饋循環:review 採納的決定回寫規範檔(已實際運轉,例:GEN-06 套件命名)。

### 2. 需求 → 開發流程(Matt Pocock skills)

```
/grilling → /to-spec → /to-tickets(GitHub Issues)→ /triage → /tdd → /code-review(規範軸 + 規格軸)
```

- Issue tracker:GitHub Issues(taiwanhua/cookhome,`gh` CLI);triage 標籤五個預設值;設定在 `docs/agents/`。
- TDD:測行為不測外觀;AI 先寫測試 → 人審測試(= 驗收介面)→ 實作;E2E 刻意少。

### 3. 設計系統 ✅ 起手式完成(2026-09-03)

- 程式碼是唯一真實來源,Figma 是投影;風格走 Minimal(MUI theme 客製,不買模板)。
- 已完成:兩層 tokens(品牌層可整包替換)、`createAppTheme`、Storybook + Palette Lab、首批元件。
- 一致性機制:唯一供給(只准用 `@repo/ui`)+ 元件內只用語意 token + AI 產稿只從 Figma 庫組裝。
- front 走 Figma 設計稿階段;admin 直接 spec → code。

### 4. CI/CD 與部署 ✅ 學習路線全數完成(2026-09-04)

- 原則:CI = 驗證 + 產 artifact(image 以 SHA 標記);CD = 同一 artifact 部署;本地 hooks 與 CI 同一套指令。
- 三個網域上線:`www`(Vercel front)/ `erp`(admin)/ `api`(Cloud Run,min=0/max=2)`.cookhome.online`;Cloudflare 管 DNS。
- `deploy.yml` + WIF:**全環境一律手動 workflow_dispatch**(merge 不觸發部署;早期曾自動部署 dev,已廢);Budget NT$600 三段警告。
- Atlas `cookhome-dev` 已接(URI 走 Secret Manager);GraphQL Sandbox 以 env 控制,雲端預設關。
- 不做(記錄):固定出口 IP(VPC connector + NAT ~US$10/月)、Cloudflare 橙雲(需 Global LB)。
- 細節見 `docs/deployment.md`。

### 5. 版本策略 ✅ 已統一(2026-09-03)

同一套件全 repo 同版本;裝套件前查 registry 不憑記憶。React 19.2、MUI 9.4、Vite 8.2、Storybook 10.6、TS 5.9.3、ESLint 9.39;unicorn 釘 65(等 ESLint 10)。套件名一律 `@repo/`(GEN-06)。

---

## 二、待辦與待討論

### A. 已完成(2026-09-03)

1. ~~commit 整理~~ — 拆成 5 個主題 commit。
2. ~~Claude Code hooks~~ — PostToolUse 編輯後自動 lint + typecheck,失敗 exit 2 回饋 AI 當場修。
3. ~~ci.yml~~ — PR 與 main push 觸發;**branch protection 不設**(免費方案不支援,純自律走 PR,規則在 CLAUDE.md)。
4. ~~front build 依賴 api~~ — CI 用 service container + 空 DB;Vercel build 打正式 api(api 先上)。

### B. 需要討論決策

<!-- prettier-ignore -->
5. **設計系統收尾** — 大致完成(2026-09-05):
   - ~~styling.md(STYLE-01~05)~~、~~designSystemWall lint 牆~~、~~Storybook 部署(design.cookhome.online,只建 main)~~
   - ~~theme 補完~~:OKLab 感知混色、四組狀態色、z1~z24 shadows、typography、11 個元件 styleOverrides — 全部是主色的函數,換色一行全自動重算
   - ~~figma-generate-library 投影~~:Wowgo 團隊「CookHome Design System」— 65 變數、15 effect / 13 text styles、Button/TextField/Card/Link 等;Code Connect 需 Org 方案 → 以元件 description + Storybook 連結替代
   - styling 選型定案:MUI + sx 一路走到底(否決 Tailwind 混用;Base UI + Tailwind 留給未來新專案)
   - 剩:自訂 `/to-figma` skill
6. ~~staging 環境時機~~ — 已解決(2026-09-04):三環境分支模型落地。
7. ~~i18n 方案~~ — 已完成(2026-09-04):`@repo/i18n`;front 用 next-intl(SSG×2 + ISR)、admin 用 use-intl、api 語言無關;規範 I18N-01~05。內容資料多語 = 未來 schema 問題,與 UI i18n 分開。
8. **Budget 終極斷路器** — Pub/Sub + Cloud Function 自動解綁 billing;看過前幾個月帳單再決定。
9. **AI 自動 PR review 時機** — Actions 上的 AI review 與本地 `/code-review` 的分工。
10. **Turbo remote cache** — 等 CI 時間變長再評估。

15. **admin shell 規格備忘(2026-09-05,設計稿已畫)** ✅ 已實作(#66 側欄與殼、#67 頁籤列;正本:ADR-0011「路由與導向規則」、`apps/admin/src/features/shell/`;子 tab 只留擴充點)
    - 側欄:依 module 設定分層、群組可展開收合(Draft/NavGroup + NavItem)。
    - 路由頁籤列(Draft/RouteTab):開過的路由生成 tab、以路由 id 去重;點側欄 → 出 tab 並切換;鑽入詳情生成「模組 / 項目名」子 tab;可關閉、可拖曳排序(dnd-kit)。

16. **建模組 skill(module-scaffold,2026-09-05)** — 協助建立新後台模組(Figma 畫面 + code 鷹架),與 /to-figma skill 合併設計。
    - **模板 = 示範模組**(2026-09-12 定案,規格見 `docs/modules/demo.sub.sample-one.md` 與 `demo.sample-two.md`,測試劇本 `docs/testing/permission-scenarios.md`):三層樹、隱藏頁(`-page` 結尾)、CRUD + wildcard、欄位級權限與頁面自有權限、資料範圍規則示範、公私雙檔案欄位、測試劇本 — scaffold 照抄改名。
    - **必問使用者**:①模組中文命名(語系中文,避免英文;既定:組織管理/使用者管理/角色管理/模組與權限/欄位管理)②掛哪個側欄群組、共幾層(1~3)③生成哪些頁(列表/詳情/新增/編輯)④RouteTab 顯示名稱 ⑤有無檔案/圖片欄位 → 引導選公開或私有 bucket(準則見 ADR-0010:預設私有;需 CDN/SEO/未登入展示/社群分享才公開)⑥要不要宣告資料範圍目標(dataScopeTarget,ADR-0008)。
    - **Figma 做法已定型**:殼元件(AdminSideNav/AdminAppBar/AdminRouteTabs)instance 覆寫 + 「備用槽」模式(預埋隱藏槽開 visible,繞過 instance 不能增減子節點);RouteTab 有 Closable 開關;API 陷阱:遍歷隱藏子節點先 `figma.skipInvisibleInstanceChildren = false`。
    - **RWD 規則**:front 每頁三檔 artboard(1440/768/375,斷點照 MUI;廣告 970/728/320);admin 單檔 1440 + 表格橫向捲動;殼元件 Device=Desktop/Mobile 變體。

17. **開發手冊 `docs/workflow.md`(2026-09-05)** — 「什麼階段用什麼 skill」總覽,讓工具不再被遺忘(使用者:「我根本忘記它的存在」)。
    - 素材:mattpocock 工程 skills、figma 三件套、repo skills、自訂(待建:/to-figma、module-scaffold、project-bootstrap)。
    - 內容:標準流程圖(需求 → /grilling → /domain-modeling → /to-spec → /to-tickets → 設計稿 → /tdd → /code-review → PR → dev → staging → main)+ 每 skill 一句話用途 + 觸發時機表。

18. **模組文件系統(2026-09-07 定案;2026-09-12 修訂存放)** — 每模組兩份檔案:
    - `docs/modules/<module-key>.md`:內部技術/業務文件(流程、規則、建模結論;可用平台詞彙)。
    - `apps/admin/src/md/module-help/<module-key>.help.md`:給使用者的說明,**不進 DB、不走 seed** — admin build 時 Vite glob raw import 打包(dev 有 HMR),「?」彈窗以模組 key 渲染。放 admin 內是為了 app 自包含與 turbo 快取正確。
    - **help 邊界(2026-09-09)**:讀者是租戶使用者 — 不得出現平台視角詞彙(根組織/租戶/開通/跨租戶/開發流程),窗口統一「系統管理員」;平台事實寫在 `.md` 的「平台視角」段。例外:根組織專屬模組的 help 讀者即系統管理員。
    - 兩份受眾不同、內容不同,同 PR 維護。五個底座模組雙檔已完成初稿(2026-09-09)。

19. **專案模板 skill(project-bootstrap)** — 還有兩個 front+admin+api 專案要開;以 cookhome 為基底,品牌落點在 `docs/branding.md`,skill 化後帶參數(品牌名、網域、GCP 專案)自動替換 + 走 deployment.md 建基礎設施。時機:第二個專案要開時。

20. **權限相關 Figma 重畫與新畫(2026-09-13 更新;2026-09-21 收斂)** — 只剩示範模組的頁面:
    - 示範模組1:列表頁(instance 組裝、三層側欄展開)、詳情頁、新增/編輯頁(共版型,含示範分類下拉、internalNote、UploadField ×2)、刪除確認;模組2 同版型不畫,註記卡說明。**等第 5 段的示範模組**。
    - ~~權限矩陣重畫~~、~~「資料範圍」頁新畫~~ — **均已完成(2026-09-21)**:Figma 44:44 / 166:318 已畫,程式為 #208 / #210;規則正本分別在 `docs/modules/role-manager.md`「權限矩陣規則(逐條)」與 ADR-0008。

22. **接手考核機制(2026-09-13 定案)** — 驗「無 session AI 能否理解專案」的三關:①場景推理題(考卷 `docs/testing/handover-quiz.md`,只放題目)②流程計畫題(給小任務只寫計畫)③實戰(票實作)。**標準答案與其存放位置皆不記於 repo**(由主考官持有,施測時只提供給評分 agent);施測=派受測 agent 作答(限 repo 內容)→ 派評分 agent 對照答案卷出報告 → 錯題視為文件缺口,修文件後重考。

21. ~~`apps/db-migrator` 實作~~ — **全部完成(2026-09-18)**:migrate(#24)、seed runner(#28)、欄位種子(#30)、模組樹/權限/綁定(#29);deploy.yml 接 migrate → seed + `ROOT_ADMIN_*`(PR feat/deploy-migrate-seed)。

26. **CI 沒有 format 檢查(2026-09-16,agent 發現)** — #25 產出與 prettier 設定不一致,跑 `prettier --write` 會重排;CI 只 lint 不 format-check,遲早有人踩。待辦:ci.yml 加 `prettier --check`,先把既有檔案格式化一次。

27. **抽 `@repo/db-schemas` 共用型別(2026-09-16 記)** — seed 與 api 的欄位形狀存在兩處(ADR-0002 種子定案段);漂移開始咬人時把 schema 抽成 packages 套件供兩邊 import 型別。

28. **BaseRepository 支援 populate(2026-09-16 記)** — 目前 populate 子查詢不帶操作者上下文、對租戶資料拋錯(ADR-0005 已知限制);需要時加 `populate` 選項由 repository 轉傳上下文。

30. **wildcard 改為同層語意 + 模組 key 全樹累加(2026-09-17 定案,#29 實作時發現三條規則互相打架)** — `X.*` 只代表模組 X 自己這層,每個模組(含群組、隱藏頁、api 樹)固定一筆 `*`;整組全給 = 子樹每模組各存一筆;比對改「擁有模組 key + `.*`」一次查表。治理模組 key 定案 `system.<name>`(六份 module 文件與 help.md 已改名)。規則正本 ADR-0004;矩陣 UI 規則 role-manager.md;module-scaffold(#16)產模組時 key 必累加父 key、`*` 自動產生。

31. **種子文件的兩種欄位(2026-09-17 定案)** — 「每次都 seed 的欄位」(預設)與「初始 seed 值的欄位」(`enabled`,建立時寫入、之後由人管);seed 不分環境,示範家族 production 手動停用。正本 ADR-0002。

29. **開通租戶時勾選開放模組(2026-09-16 定案,第 3 段做)** — 開通彈窗加模組勾選(預設全勾,清單來自模板);副本只綁勾選的模組;Figma 開通彈窗 + org-manager.md 同步。規則已寫 ADR-0009。

25. **設計殘項(等食譜域第二輪 domain modeling)** — 食譜詳情頁、分類頁;front 會員線(註冊 — 含 account 欄位、登入、個人頁、寫食譜、收藏);會員管理頁(admin)。

### C. 小任務(不需討論,找時間做)

<!-- prettier-ignore -->
11. ~~deploy.yml 的 api_url 換自訂子網域~~ — 已完成(2026-09-05,PR #11~#13)。
12. **Atlas 拆三 cluster** — 已定案要拆(2026-09-04);時機:production 有真實流量升 M10 時(或先三個 Atlas project 各一 M0)。過渡加固:三環境 URI 皆 `maxPoolSize=10`。

24. ~~看板移卡自動化~~ — **已完成(2026-09-14,PR #32)**:Project「CookHome」(#3)十欄 Status;Action 連動 issue/PR 事件(規則與移卡指令見 issue-tracker.md)。生效前置:repo secret `GH_PROJECT_TOKEN`(PAT classic,project scope)由使用者建立。

23. **Claude hook 在 git worktree 誤報(2026-09-13,無 session agent 發現)** — `scripts/claude-hooks/post-edit-check.mjs` 固定從主 repo 目錄跑 turbo;在 git worktree 內開發新 workspace 時,主 repo 的 turbo 找不到該套件而誤報「No package found」。修法:hook 以「被編輯檔案向上找到的 repo 根」為工作目錄。

### D. 外部條件觸發(追蹤中)

13. **unicorn 升級** — 等 ESLint 10 生態穩定,連 ESLint 一起升。
14. **api 錯誤處理總策略 / module 邊界細則 / schema 演進規範** — 等 api 長出第二個 feature 再歸納。

---

## 三、建議的進行順序

底座領域模型與文件已定稿(ADR-0001~0010 + CONTEXT.md,2026-09-12 commit f4ede9f)。接下來:**示範模組**(文件已定 → Figma #20 → 進實作當第一個真功能,走完整流程 /to-spec → tickets → /tdd)→ 食譜域第二輪 /domain-modeling → 其餘看時機。
