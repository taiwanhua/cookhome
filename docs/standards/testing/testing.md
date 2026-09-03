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
