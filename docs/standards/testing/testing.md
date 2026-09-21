# 測試(TEST)

## TEST-01 測行為,不測實作

斷言使用者(或呼叫端)可觀察的結果;不斷言內部 state、私有函數、呼叫次數(mock 系統邊界除外)。重構不該弄壞測試。

```tsx
✅ expect(screen.getByText("還沒有食譜")).toBeInTheDocument();
❌ expect(component.state.recipes).toHaveLength(0);
```

## TEST-02 測試名稱描述行為,中文可

```ts
✅ it("空清單時顯示空狀態文案", …)
❌ it("works", …)  /  it("test recipes", …)
```

## TEST-03 前端 mock 在網路層(MSW),不 mock hooks

用 MSW 攔截 GraphQL 請求回假資料;禁止 mock `useXxxQuery` 本身 — mock hooks 等於沒測資料流。

## TEST-04 AI 協作流程:測試先行,人審測試即驗收介面

1. AI 先寫測試(紅燈,包含「編譯不過」— 測試就是介面設計)
2. 人 review 測試 = 驗收介面與行為設計
3. 通過後才實作到綠燈

## TEST-05 E2E 刻意少

Playwright 只覆蓋關鍵流程(如:瀏覽食譜、新增食譜);其他行為交給元件/整合測試。E2E 慢且脆,數量是成本。

## TEST-06 測試檔與受測物同層

新測試放受測檔旁邊 `xxx.test.ts(x)`(如 `counter-button/index.test.tsx`);既有的 `__tests__/` 目錄沿用不強制搬。

## TEST-07 api 的整合測試:打真的 GraphQL 端點,對真 MongoDB

api 的功能測試只有一個接縫:用 supertest 對啟動起來的 Nest app 打 `/graphql`(本地自起 mongodb-memory-server;CI 用 service container),驗回應與資料庫最終狀態。固定做法(先例:`apps/api/src/auth/auth.test.ts`、`test-support/auth-app.ts`):

- **夾具**:測試開始前以**子行程**跑 db-migrator 的 `seed` 指令種資料(root 帳號、模組樹、權限、種子角色);STRUCT-01 禁 app 互 import,所以不能 import seed 的程式碼。額外的測試角色 / 使用者用 RelationService 具名方法或直接寫測試資料庫建(測試檔不受裸查詢禁令約束)
- **信件不真寄**:注入記錄用的 `MailService` adapter,測試從它讀出 token 走下一步;api 未設 `RESEND_API_KEY` 時本來就是這個模式
- **測試專用的 resolver / module**(如驗 `@RequirePermission` 用的探針端點)放 `test-support/`,只在測試的 `extraModules` 掛上;**測試用 app 的 schema 走記憶體**(`NODE_ENV=test` 時 `autoSchemaFile: true`),探針才不會寫進提交的 `schema.gql`
- 例外:某個能力在 GraphQL 端點上看不到(如守門器產出的操作者上下文)才允許經 `app.get(Service)` 從 DI 取出來驗 — 這是第二個接縫,PR 要說明理由
- 執行:ts-jest 只轉譯不做型別檢查(`isolatedModules`),型別交給 `check-types`;整張 Nest 依賴圖做型別檢查會讓第一次啟動超過 5 分鐘

## TEST-09 ui 元件測試:React Testing Library,斷言行為不只是不炸

`packages/ui` 的元件測試用 `@testing-library/react` + `user-event` + `jest-dom`(版本與 admin 同,守版本統一策略),`src/test/setup.ts` 載入 jest-dom 並 `afterEach(cleanup)`。**preset 自 2026-09-20(#197)起是 `browser-esm` 但覆寫 `testEnvironment: "jsdom"`**(原本是 `browser`;設定搬到 `packages/ui/jest.config.mjs` 才放得下理由註解)。

**ESM-only 依賴進 `packages/ui` 的兩步**(react-markdown / remark-gfm 這類只出 ESM 的套件,CJS 模式一 `require` 就是 `Unexpected token 'export'`):

1. preset 換成 `@repo/jest-presets/browser-esm`(ts-jest ESM 模式);
2. **把 `testEnvironment` 覆寫回原生 `jsdom`** — `browser-esm` 為了 MSW 用的是 `jest-fixed-jsdom`,它把 `Blob` / `File` 換成 Node 的版本,`URL.createObjectURL` 那類 API 會炸(`UploadField` 一次紅四個測試)。admin 需要 MSW,所以 admin 不做這個覆寫;ui 沒有 MSW,兩邊因此設定不同。每個元件至少驗:渲染出設計稿的結構、主要互動(點擊 / 勾選 / 關閉)會回報、disabled 時不回報。舊的「`createRoot` 不炸」冒煙測試不算數,碰到就改寫。MUI 9 的兩個陷阱:`Switch` 的 input 是 `role="switch"` 不是 `checkbox`;disabled 的核取框是 `pointer-events: none`,要驗「點下去也沒事」用 `userEvent.setup({ pointerEventsCheck: 0 })`。`inputProps` 已不被 Checkbox / Radio / Switch 消化(會漏到 DOM),改 `slotProps={{ input: … }}`。

**驗「某個狀態有沒有換樣式」不要用 `getComputedStyle`,直接讀 CSS 規則**(2026-09-21,#260 / PR #272 踩到):jsdom 的 `getComputedStyle` **不比對 specificity**,只照樣式表順序套最後一條相符的規則,而且對 `+` 兄弟選擇器支援不完整。`Switch` 的停用態軌道色正好寫在 `.Mui-disabled + .MuiSwitch-track`,用 `getComputedStyle` 一律讀回 MUI 自己那條 —— 元件有沒有補停用色完全驗不出來,測試會假綠。改用 `packages/ui/src/test/css-rules.ts` 讀 emotion 實際產生的規則:

```ts
const root = container.querySelector(".MuiSwitch-root")!;
const rules = cssRulesMatching(emotionClassOf(root), "Mui-disabled", "track");
expect(declaredValue(rules, "background-color")).toBe(disabledTrackColor);
```

`emotionClassOf(element)` 取該元素的 `css-…` 類別(用來把範圍收斂到自家元件),`cssRulesMatching(...needles)` 取選擇器同時含這幾段字串的規則,`declaredValue(rules, prop)` 取最後一條宣告的值(沒有任何規則宣告時回 `null`,正好拿來斷言「這個狀態沒有自己的樣式」)。**單純的後代選擇器**(如 Tree 依深度的縮排)`getComputedStyle` 讀得到,照常用即可。

**數值型樣式值的斷言要照 emotion 實際寫出的字串**(2026-09-22,#300):MUI / emotion 只對**非零**數值補 `px`,`minHeight: 0` 寫出來是 `min-height: 0`,不是 `"0px"`。`expect(declaredValue(rules, "min-height")).toBe("0px")` 會紅得莫名其妙 —— 斷 `"0"`。同理 `lineHeight`、`flex`、`zIndex` 這類無單位屬性也不要自行加單位。

## TEST-08 admin 的元件測試:MSW 攔網路層 + React Testing Library

先例:`apps/admin/src/test/`(`setup.ts` MSW 生命週期、`msw/server.ts`、`msw/auth-handlers.ts`、`render.tsx` 的 `renderApp()`),測試檔與元件同資料夾、同名 `.test.tsx`(GEN-01)。

- preset 用 `@repo/jest-presets/browser-esm`(jsdom + Node 的 fetch / Request / Response / BroadcastChannel 全域給 MSW;ts-jest ESM 模式 — react-router 8、use-intl 4 只出 ESM);`packages/ui` 用同一個 preset 但覆寫 `testEnvironment`(TEST-09)
- **httpOnly cookie 在 jsdom 看不到**,用 `authWorld({ hasRefreshCookie })` 這類旗標模擬「瀏覽器有沒有帶 cookie」並計數請求;MSW `server.use()` 的 handler **先列的先贏**
- 渲染一律用 `renderApp()`(帶 Intl / Theme / QueryClient / Session / Router 的完整 providers),不裸 render 元件
- 逾時有兩層:preset 的 `testTimeout` 15 秒(單一測試)之外,testing-library 的 `findBy*` / `waitFor` 預設只等 1 秒;`src/test/setup.ts` 已 `configure({ asyncUtilTimeout: 5000 })`,串三段查詢的頁面在 CI runner 上才不會偶發紅
- jsdom 陷阱:`URL.createObjectURL` 在 `jest-fixed-jsdom` 會炸(補回來的是 Node 的 `URL`,只收 Node 的 `Blob`),測到上傳預覽的頁面要在測試檔 stub;MUI 樹「點內容區 = 選取 + 展開 / 收合」,測試先點父再點子要注意順序
- **MSW 夾具的形狀以 api 測試的斷言為準**(`apps/api/src/**/*.test.ts` 裡有現成斷言可對照):`tenantTree` 夾具曾把樹根的 `parentId` 寫成有值,而 api 對樹根一律回 `null`,讓前端拿 `parentId` 判視角的 bug 在測試裡是對的(#186)
- 頁面測試怎麼分檔:一頁一個 `<Page>.test.tsx` 放主流程;超過 `max-lines` 400 就依情境拆成 `<Page>Scope.test.tsx`、`<Page>Dialogs.test.tsx`…,共用的 world / 夾具 / helper 抽成同資料夾的 `<page>-test-support.ts`(kebab,非元件)
- 跑法:**`pnpm exec turbo run test --filter=@repo/admin`**(turbo 會先 build `ui` / `graphql` / `domain`)。`pnpm --filter @repo/admin test` 不經 turbo、**不會 build 依賴**,新 checkout 或依賴改過就會炸型別(第 2 段三位實作者都撞到,2026-09-19 改正)
- 逾時:`browser-esm` preset 已放寬 `testTimeout` 到 15 秒(CI runner 慢,jsdom + MSW + ts-jest ESM 的第一個測試要付暖機成本);個別測試不再自行加 timeout
- **只跑一個測試檔**:`pnpm --filter @repo/admin test -- --testPathPatterns=X` 在 pnpm 底下會把 `--` 一起傳進去而 `No tests found`,要**直接在 `apps/admin` 跑** `node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPatterns=X`(#209)。整包驗收仍用上面的 turbo 指令
- **Vite 專屬語法進不了 jest**:`import.meta.glob`(`?raw` 載入 md、圖片清單…)是 Vite 的編譯期轉換,jest 直接載入會 `(intermediate value).glob is not a function`。做法:**把 glob 包成一支只有 glob 的模組**(`lib/help-registry.ts`),測試用 `moduleNameMapper` 整支換成 `src/test/` 的假實作(介面相同,另給 `setXxx` / `resetXxx`,`setup.ts` 每個測試後歸零);判斷邏輯不要放進被換掉的那一層,抽成純函式另外測。**不要**逐檔 `jest.unstable_mockModule` — 殼的所有測試都會經過它,等於每個測試檔都要動(#197)
- **jest 的 `moduleNameMapper` 也是先列的先贏**:`^@/lib/help-registry$` 這種精確鍵要排在通則 `^@/(.*)$` **前面**,否則被通則吃掉(#197)
- **`React.lazy` + 動態 `import()` 不必 mock**:`browser-esm` preset 是 ESM 模式(`--experimental-vm-modules`),`import("@repo/ui/markdown")` 這種子路徑匯出在 jest 裡解得開,照常渲染。要改的只有斷言時機 —— 懶載入的內容多一個 `Suspense` tick,**該邊界底下的第一筆斷言一律用 `findBy*` / `waitFor`**(`await within(dialog).findByRole("heading", …)`),沿用 `getBy*` 會抓到 fallback 而紅;同一邊界底下後續的斷言不必再等。**不要斷言 fallback 本身**(chunk 常在同一個 tick 內就解析完,會偶發)(#215)
- **MSW 的假伺服器若有「連動 / 狀態」語意就實作進 handler**,不要回固定資料:停用模組連動子樹、儲存後重查要拿到新值這類驗收條件,對著無狀態的假伺服器根本驗不到,還容易寫出「對著比 api 寬鬆的假伺服器才會過」的測試。先例 `test/msw/module-manager-handlers.ts`(#209)
- **多段接力載入的頁面**(先查清單 → 選中第一筆 → 再查它的細節)在測試裡要等兩段以上:把「等到第 n 段畫面就緒」抽成同資料夾 `<page>-test-support.ts` 的 async helper 共用,不要每個案子各寫一串 `findBy*`(#210 / #211)
- **測試數的基準用「在 `origin/main` 跑一次」取得,不要沿用別的 PR 寫死的數字**:同一段多票並行時,別人先合的票會墊高基準,照抄舊數字會讓 PR 的「+N」對不上(#207 起四段並行都踩過)。**取基準時不要用 turbo**:快取跨 worktree 共用,同一份輸入別人跑過就 `cache hit, replaying logs`,結果可能根本沒印出來或印的是別人的。進 package 目錄直接跑 jest(2026-09-21 補):

  ```
  cd packages/ui && pnpm run test
  cd apps/admin && pnpm run test
  ```

  `pnpm run test`(= 該包 `package.json` 的 `node --experimental-vm-modules node_modules/jest/bin/jest.js`)不經 turbo、快取不會誤命中。**不要用 `pnpm exec jest`**:少了 `--experimental-vm-modules`,ESM 測試直接炸,看起來像測試壞了(2026-09-22 補)。前提是依賴已 build 過(`pnpm exec turbo run build --filter=@repo/graphql --filter=@repo/ui --filter=@repo/domain`);驗收自己的改動仍用 turbo(輸入變了不會誤命中)

- **zustand `persist` 的 `setState` 會回寫 storage**(2026-09-22,#295):測「重新整理後狀態維持」時,直覺寫法 `useXStore.setState({ ... 預設值 })` + `rehydrate()` 會先把 localStorage 也覆寫成預設值,再讀回預設值 —— 看起來像「狀態沒被記住」,其實是測試自己把存檔抹掉了。正確順序是:**先把 storage 的內容存起來 → 歸零 store → 把存檔放回 storage → 才 `rehydrate()`**。另外 store 是模組層單例,`src/test/setup.ts` 要在每個測試後歸零(同語言 store 的理由)
- 輸出雜訊:Jest 30 + ESM 印 experimental warning,無害;看結果用 `| grep -E "Tests:|FAIL|●"`

### mock 開發模式:用同一批夾具把 admin 跑在瀏覽器上(#194,2026-09-22)

沒有 dev 帳號、也不想連真 api 時,用**同一批 MSW 夾具**把整個 admin 跑起來,拿來截圖驗版面(admin 票的 PR 要附圖,見 `docs/agents/issue-tracker.md`)。跑的是**真的 `App`**(同一組 providers、路由與頁面),只有網路層被 service worker 接管。

```
pnpm --filter @repo/admin dev:mock     # http://localhost:3002
```

- 預設**自動登入 root**、落在總覽;側欄的組織 / 使用者 / 角色 / 模組與權限 / 欄位 / 資料範圍都有假資料
- 網址參數:`?view=tenant` 切租戶管理員視角(少掉兩個 `isRootOnly` 模組、組織樹換成租戶那一棵)、`?auth=off` 停在登入頁(任何帳密都能登入)
- 深層網址與重新整理都可用(`vite.mock.config.ts` 把 HTML fallback 指到 `mock.html`)
- **截圖**:瀏覽器開上面的網址 → 走到要驗的頁 → 截整個視窗(側欄 + 內容),PR 內文逐張寫明「哪一頁、什麼狀態」;彈窗類的改動要各截一張開啟前後

實作面三件事,改動前先看懂再動:

- **入口完全獨立**:`mock.html` + `src/mock/` + `mock-public/mockServiceWorker.js` + `vite.mock.config.ts`,正式 build 只讀 `vite.config.ts` 與 `index.html`,所以產物不含 msw(驗收:`pnpm --filter @repo/admin build` 後 `grep -c msw dist/assets/*.js` 為 0)
- **共用端點只留一份 handler**:`orgTree` / `org` / `users` / `roles` 有多個 world 各自實作,MSW 先列的先贏 —— `src/mock/mock-world.ts` 替每個共用端點指定正本、濾掉其餘同名 handler,不要改成單純串接
- **`msw/node` 在瀏覽器載不進去**:`src/test/msw/server.ts` 在模組層呼叫 `setupServer()`,mock 模式以 alias 換成 `src/mock/msw-node-stub.ts`(夾具只用到同檔的 `api`,`server` 僅出現在型別位置)。**不要為了 mock 模式去改 `src/test/msw/server.ts`** —— 那支是 jest 測試的正本

## TEST-10 時間相關的斷言:不可用呼叫「前」的 `Date.now()` 當上界

效期 / 到期時間通常是受測程式在呼叫**當下**(較晚)以 `Date.now() + TTL` 算出來的,所以拿呼叫**前**取的 `before` 去斷言 `expiresAt - before <= TTL`,只要呼叫過程經過 ≥ 1 ms 就必然失敗 —— 本機快、幾乎同毫秒完成而僥倖綠,CI runner 慢一點就紅。**這類斷言不是偶發,是方向錯**(#227:`storage.test.ts` 三案在 CI 三次命中)。改法二選一,並在測試註解寫選哪個與理由:

- **優先假時鐘 + 精確相等**:`jest.useFakeTimers({ now })` 固定時間,斷言 `expiresAt.getTime()` 等於 `now + TTL`,`finally` 裡 `jest.useRealTimers()` 收尾。前提是受測路徑沒有非同步計時器(`await` 走 promise microtask,不受假時鐘影響;有真計時器才會卡住)
- **否則用呼叫後的時間夾上界**:`expect(ttl).toBeLessThanOrEqual(TTL + (Date.now() - before))`,別用固定容差硬湊

## 已知偶發(CI 紅先對這裡)

- `apps/api/src/auth/password/password.test.ts` 的 `setPassword` describe 四案偶爾整組逾時(2026-09-18 兩次,重跑即過;疑與 CI runner 慢 + argon2 雜湊有關)。重跑一次仍紅才算真的紅。
