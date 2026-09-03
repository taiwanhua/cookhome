# React 元件寫法(REACT)

## REACT-01 function 宣告 + 具名匯出;props 用 `Readonly<XxxProps>`

```tsx
✅ interface LinkProps { … }
   export function Link({ href }: Readonly<LinkProps>) { … }
❌ export default ({ href }: any) => { … }
```

(Next.js 的 page / layout 必須 default export,屬框架要求的例外。)

## REACT-02 狀態放哪:照決策樹,不自創全域 store

1. 伺服器資料 → TanStack Query(codegen hooks),**不要**複製進 useState。
2. URL 能表達的(頁碼、篩選、tab)→ URL(searchParams / router)。
3. 只有單一元件用 → `useState`。
4. 跨元件 → 先狀態提升(lifting);要跨很遠再用 context。
5. 全域 store(zustand / redux 等)→ **目前禁止**,需要時先開討論、記 ADR。

## REACT-03 業務邏輯離開 JSX

JSX 內只放渲染邏輯;超過幾行的計算、轉換、條件組合抽成 hooks(有狀態)或 utils(純函數)— 這也是讓邏輯可測的前提。

```tsx
✅ const { totalMinutes } = useRecipeStats(recipe);
❌ <p>{recipe.steps.reduce((a, s) => a + s.minutes, 0) + (recipe.prep ? … : …)}</p>
```

## REACT-04 front 預設 Server Component,`"use client"` 下推到葉子

只有需要互動(事件、hooks、瀏覽器 API)的元件才標 `"use client"`,而且標在最小的葉子元件上,不要整頁標掉。(admin 是純 client 的 Vite app,不適用本條。)

## REACT-05 props 傳遞超過兩層先重組,composition 優先於 context

```tsx
✅ <RecipeCard actions={<DeleteButton id={recipe.id} />} />   // 用 children/slot 組合
❌ <RecipeCard onDelete={onDelete} />  // onDelete 只是為了往下傳第三層
```
