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

## REACT-06 遵守 `eslint-plugin-react-hooks` v7 的 compiler 規則,狀態容器用外部 store

lint 入口啟用的 react-hooks v7 除了 `rules-of-hooks` / `exhaustive-deps`,還有 React Compiler 的一組規則,它們實質決定狀態要怎麼寫:

- `set-state-in-effect`:**effect 內不可直接 setState**(同步 sessionStorage、依網址補 tab 這類「衍生狀態」都算)。要嘛在 render 期間用 `useMemo` 推導,要嘛把狀態搬進外部 store,以 `useSyncExternalStore` 訂閱(先例:`apps/admin/src/features/shell/route-tabs-store.ts`,純函式 + `createRouteTabsStore`,殼 mount 時建立、一使用者一份)
- `refs`:render 期間不讀寫 `ref.current`;只在事件處理與 effect 內用
- `globals`:render 期間不改模組層變數
- `immutability`:props / state 不就地修改,陣列用 `toSorted` / 展開建新值

判斷順序:能用 `useMemo` 從既有 state / props 推導 → 推導;需要跨元件、跨 render 存活且有副作用(storage、channel)→ 外部 store + `useSyncExternalStore`;仍不夠再考慮 context(REACT-02)。
