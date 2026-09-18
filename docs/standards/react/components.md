# React 元件寫法(REACT)

## REACT-01 箭頭函數 + 具名匯出;props 用 `export interface XxxProps` 獨立宣告

(2026-09-19 改,ADR-0012;lint:`func-style` / `react/function-component-definition`,各包完成重構後啟用)

```tsx
✅ export interface ShellAppBarProps {
     me: MeQuery["me"];
     title: string;
   }
   export const ShellAppBar = ({ me, title }: ShellAppBarProps) => { … };

❌ export function ShellAppBar({ me, title }: Readonly<ShellAppBarProps>) { … }   // 舊寫法
❌ export const ShellAppBar = ({ me, title }: { me: …; title: string }) => { … }   // props 型別寫在參數裡
❌ export default ({ href }: any) => { … }
```

- 元件、hook、一般函式**一律箭頭函數**;只有需要 overload 或 `function*` 的才用 `function` 宣告,並以行內豁免附原因(STRUCT-05)。
- props 型別**獨立宣告、`export`、用 `interface`**(GEN-03 命名 `XxxProps`);參數不再包 `Readonly<>`(props 本來就不該改,包起來只是雜訊)。
- Next.js 的 page / layout 必須 default export,屬框架要求的例外。

## REACT-02 狀態放哪:照決策樹;跨元件的用戶端狀態用 zustand

(2026-09-19 改,ADR-0012:原「全域 store 禁止」改為 zustand 是唯一的跨元件狀態容器)

1. 伺服器資料 → TanStack Query(codegen hooks),**不要**複製進 useState 或 store。
2. URL 能表達的(頁碼、篩選、tab)→ URL(searchParams / router)。
3. 只有單一元件用 → `useState`。
4. 跨元件的用戶端狀態(登入狀態、語言、路由頁籤…)→ **zustand**:`stores/useXxxStore.ts`,需要跨重新整理保留的用 `persist` middleware(sessionStorage / localStorage 由該狀態的規則決定)。
5. context **只剩注入用**(theme、QueryClient、Intl provider),不承載會變的狀態;redux / 自刻 `useSyncExternalStore` store 不用。

```ts
✅ export const useRouteTabsStore = create<RouteTabsState>()(persist((set) => ({ … }), { name: "cookhome-admin-route-tabs", storage: createJSONStorage(() => sessionStorage) }));
❌ const LocaleContext = createContext<{ locale; setLocale }>(…)   // 承載狀態的 context
```

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

## REACT-06 遵守 `eslint-plugin-react-hooks` v7 的 compiler 規則

lint 入口啟用的 react-hooks v7 除了 `rules-of-hooks` / `exhaustive-deps`,還有 React Compiler 的一組規則,它們實質決定狀態要怎麼寫:

- `set-state-in-effect`:**effect 內不可直接 setState**(同步 storage、依網址補 tab 這類「衍生狀態」都算)。要嘛在 render 期間用 `useMemo` 推導,要嘛把狀態放進 zustand store(REACT-02),由 store 的 action 與 `persist` 處理副作用
- `refs`:render 期間不讀寫 `ref.current`;只在事件處理與 effect 內用
- `globals`:render 期間不改模組層變數
- `immutability`:props / state 不就地修改,陣列用 `toSorted` / 展開建新值

判斷順序:能用 `useMemo` 從既有 state / props 推導 → 推導;需要跨元件、跨 render 存活且有副作用(storage、channel)→ zustand store;仍不夠再談。

## REACT-07 一檔一元件;單檔以 300 行為目標,超過就拆

(2026-09-19,ADR-0012;lint 硬上限 `max-lines` 400,各包完成重構後啟用)

- 一個 `.tsx` 只匯出一個元件(檔名 = 元件名,GEN-01);同檔可以有它專用的小型 helper,但不能有第二個元件。
- 300 行是**目標不是門檻**:301 行不算違規,重點是切得合理。拆法依序:子元件(放到同名資料夾底下,GEN-01)→ 有狀態的邏輯抽 hook(`useXxx.ts`,只有這個元件用就跟元件同資料夾)→ 純函式抽到 `lib/`(REACT-03)。
- 400 行由 lint 擋,超過就一定要拆;300 到 400 之間的在 PR 說明為何不拆。

```
✅ RouteTabs/RouteTabs.tsx(列的組裝)+ RouteTabs/SortableTab.tsx(單一 tab)+ RouteTabs/useRouteTabs.ts
❌ route-tabs.tsx 315 行,RouteTabs 與 SortableTab 同檔
```
