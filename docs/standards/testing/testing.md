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

`packages/ui` 的元件測試用 `@testing-library/react` + `user-event` + `jest-dom`(版本與 admin 同,守版本統一策略),preset 仍是 `browser`,`src/test/setup.ts` 載入 jest-dom 並 `afterEach(cleanup)`。每個元件至少驗:渲染出設計稿的結構、主要互動(點擊 / 勾選 / 關閉)會回報、disabled 時不回報。舊的「`createRoot` 不炸」冒煙測試不算數,碰到就改寫。MUI 9 的兩個陷阱:`Switch` 的 input 是 `role="switch"` 不是 `checkbox`;disabled 的核取框是 `pointer-events: none`,要驗「點下去也沒事」用 `userEvent.setup({ pointerEventsCheck: 0 })`。`inputProps` 已不被 Checkbox / Radio / Switch 消化(會漏到 DOM),改 `slotProps={{ input: … }}`。

## TEST-08 admin 的元件測試:MSW 攔網路層 + React Testing Library

先例:`apps/admin/src/test/`(`setup.ts` MSW 生命週期、`msw/server.ts`、`msw/auth-handlers.ts`、`render.tsx` 的 `renderApp()`),測試檔與元件同資料夾、同名 `.test.tsx`(GEN-01)。

- preset 用 `@repo/jest-presets/browser-esm`(jsdom + Node 的 fetch / Request / Response / BroadcastChannel 全域給 MSW;ts-jest ESM 模式 — react-router 8、use-intl 4 只出 ESM);純元件庫(`packages/ui`)仍用 `browser`
- **httpOnly cookie 在 jsdom 看不到**,用 `authWorld({ hasRefreshCookie })` 這類旗標模擬「瀏覽器有沒有帶 cookie」並計數請求;MSW `server.use()` 的 handler **先列的先贏**
- 渲染一律用 `renderApp()`(帶 Intl / Theme / QueryClient / Session / Router 的完整 providers),不裸 render 元件
- 逾時有兩層:preset 的 `testTimeout` 15 秒(單一測試)之外,testing-library 的 `findBy*` / `waitFor` 預設只等 1 秒;`src/test/setup.ts` 已 `configure({ asyncUtilTimeout: 5000 })`,串三段查詢的頁面在 CI runner 上才不會偶發紅
- jsdom 陷阱:`URL.createObjectURL` 在 `jest-fixed-jsdom` 會炸(補回來的是 Node 的 `URL`,只收 Node 的 `Blob`),測到上傳預覽的頁面要在測試檔 stub;MUI 樹「點內容區 = 選取 + 展開 / 收合」,測試先點父再點子要注意順序
- **MSW 夾具的形狀以 api 測試的斷言為準**(`apps/api/src/**/*.test.ts` 裡有現成斷言可對照):`tenantTree` 夾具曾把樹根的 `parentId` 寫成有值,而 api 對樹根一律回 `null`,讓前端拿 `parentId` 判視角的 bug 在測試裡是對的(#186)
- 頁面測試怎麼分檔:一頁一個 `<Page>.test.tsx` 放主流程;超過 `max-lines` 400 就依情境拆成 `<Page>Scope.test.tsx`、`<Page>Dialogs.test.tsx`…,共用的 world / 夾具 / helper 抽成同資料夾的 `<page>-test-support.ts`(kebab,非元件)
- 跑法:**`pnpm exec turbo run test --filter=@repo/admin`**(turbo 會先 build `ui` / `graphql` / `domain`)。`pnpm --filter @repo/admin test` 不經 turbo、**不會 build 依賴**,新 checkout 或依賴改過就會炸型別(第 2 段三位實作者都撞到,2026-09-19 改正)
- 逾時:`browser-esm` preset 已放寬 `testTimeout` 到 15 秒(CI runner 慢,jsdom + MSW + ts-jest ESM 的第一個測試要付暖機成本);個別測試不再自行加 timeout
- 輸出雜訊:Jest 30 + ESM 印 experimental warning,無害;看結果用 `| grep -E "Tests:|FAIL|●"`

## 已知偶發(CI 紅先對這裡)

- `apps/api/src/auth/password/password.test.ts` 的 `setPassword` describe 四案偶爾整組逾時(2026-09-18 兩次,重跑即過;疑與 CI runner 慢 + argon2 雜湊有關)。重跑一次仍紅才算真的紅。
