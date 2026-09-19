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
- props 型別**獨立宣告、`export`、用 `interface`**(GEN-03 命名 `XxxProps`);參數不再包 `Readonly<>`(props 本來就不該改,包起來只是雜訊)。**例外**:props 是外部庫型別的直通別名(`export type ButtonProps = MuiButtonProps`,含 union、泛型)時用 `type`,因為 `interface extends` 對 union 不成立、對空 body 會撞 `no-empty-object-type`;自己定義形狀的才用 `interface`(ui 的慣例)。
- Next.js 的 page / layout 也照箭頭函數寫,只是最後 `export default HomePage`(`const HomePage = async ({ params }: HomePageProps) => { … }; export default HomePage;`),不需要豁免 `func-style`。
- Next.js 的 page / layout 必須 default export,屬框架要求的例外。

## REACT-02 狀態放哪:照決策樹;跨元件的用戶端狀態用 zustand

(2026-09-19 改,ADR-0012:原「全域 store 禁止」改為 zustand 是唯一的跨元件狀態容器)

1. 伺服器資料 → TanStack Query(codegen hooks),**不要**複製進 useState 或 store。
2. URL 能表達的(頁碼、篩選、tab)→ URL(searchParams / router)。**admin 例外**:admin 有路由頁籤,`RouteTabs` 以 pathname 記頁籤、不處理 search,所以頁內篩選(頁碼、關鍵字、選中組織)在頁籤行為定案前留在頁面層的 `useState`,不進 URL(#139)。
3. 只有單一元件用 → `useState`。
4. 跨元件的用戶端狀態(登入狀態、語言、路由頁籤…)→ **zustand**:`stores/useXxxStore.ts`,需要跨重新整理保留的用 `persist` middleware(sessionStorage / localStorage 由該狀態的規則決定)。
5. context **只剩注入用**(theme、QueryClient、Intl provider、`AuthSession` 實例),不承載會變的狀態;redux / 自刻 `useSyncExternalStore` store 不用。注入用的 context 物件**與它的 hook 同檔、放 `hooks/`**(`hooks/useSession.ts` 同時匯出 `SessionContext` 與 `useSession`),provider 元件放 `app/providers/`。

```ts
✅ export const useLocaleStore = create<LocaleState>()(persist((set) => ({ … }), { name: "cookhome-admin-locale", storage: localeStorage }));
❌ const LocaleContext = createContext<{ locale; setLocale }>(…)   // 承載狀態的 context
```

`persist` 的兩個注意:①它預設寫 `{ state, version }` 的 JSON 封包,**沿用既有 storage key 與格式時**(`docs/branding.md` 登記的那些)要給自訂的 `PersistStorage` adapter 保住舊格式,不然既存值失效、既有測試的 storage 斷言也會壞;②key 依使用者分把(如頁籤的 `…:<userId>`)的,store 提供 `bind(userId)` 以 `persist.setOptions({ name }) + rehydrate()` 換 key,不要把 userId 寫死在 `name`。

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

render 期呼叫 store action **只允許冪等的初始化**(放 `useState` 的 lazy 初始化器,只跑一次;例:殼 mount 時 `bind(userId)` + `sync()` 讓首次渲染就有 tab),其餘 action 一律在 effect 或事件處理內。

## REACT-07 一檔一元件;單檔以 300 行為目標,超過就拆

(2026-09-19,ADR-0012;lint 硬上限 `max-lines` 400,各包完成重構後啟用)

- 一個 `.tsx` 只匯出一個元件(檔名 = 元件名,GEN-01);同檔可以有它專用的小型 helper,但不能有第二個元件。
- 300 行是**目標不是門檻**:301 行不算違規,重點是切得合理。拆法依序:子元件(放到同名資料夾底下,GEN-01)→ 有狀態的邏輯抽 hook(`useXxx.ts`,只有這個元件用就跟元件同資料夾)→ 純函式抽到 `lib/`(REACT-03)。
- 400 行由 lint 擋,超過就一定要拆;300 到 400 之間的在 PR 說明為何不拆。

```
✅ RouteTabs/RouteTabs.tsx(列的組裝)+ RouteTabs/SortableTab.tsx(單一 tab)+ RouteTabs/useRouteTabs.ts
❌ route-tabs.tsx 315 行,RouteTabs 與 SortableTab 同檔
```

## REACT-08 彈窗的初始值:關閉即卸載、props 進 `useState`、非同步資料外層 gate

REACT-06 禁止 effect 內 setState,所以「開彈窗時把資料塞進表單」不能寫 `useEffect(() => setValues(data), [data])`。固定模式(#139 / #138 的做法):

- 彈窗**關閉就卸載**(`open && <Dialog …/>`),每次開啟都是新的元件;
- 初始值由 props 帶入 `useState` 的初始化器(`useState(() => toForm(org))`);
- 需要先取單筆的編輯彈窗,在外層 gate:資料到了才掛載表單元件(`org.data ? <EditOrgForm org={org.data} /> : <Loading />`)。

## REACT-09 槽位(slot)元件一律是模組層常數;逐列資料走 context

(2026-09-20,#207 包 `RichTreeView` 時定;適用所有吃 `slots` / `components` 的外部庫)

MUI X 的 `RichTreeView`、DataGrid 這類元件收的是**元件本身**,不是元素。把槽位元件定義在 render 內(或用閉包把該列的資料綁進去),每次 render 都是一個新的函式身分 → 整棵樹重新掛載,狀態、焦點與展開都會掉。

- 槽位元件**寫在模組層**(自己的檔案,PascalCase;REACT-07),`slots={{ item: TreeItemRow }}` 傳的是常數;
- 逐列要用的資料由**容器先攤平成一份 `ReadonlyMap<id, RowState>`,經 context 交給槽位元件**,槽位元件用 `useContext` 自取,不靠 props 閉包;
- context 只當注入通道(REACT-02 第 5 點),值本身是 `useMemo` 出來的唯讀快照。

```tsx
✅ // Tree/tree-rows.ts:型別 + context(kebab,非元件)
   // Tree/TreeItemRow.tsx:槽位元件,useTreeRow(itemId) 取自己那一列
   <RichTreeView slots={{ item: TreeItemRow }} />
❌ <RichTreeView slots={{ item: (props) => <Row {...props} state={rows.get(props.itemId)} /> }} />
```

**ui 包裝層的 props 分工**(同一個 PR 定的配套規則):**內容類**的 props(`labelSuffix`、`actions`、`disabled` — 這一列長什麼樣)跟著**節點資料**走;**狀態類**的 props(`selectedIds`、`expandedIds`、`indeterminateIds`、`disabledCheckIds`)是**扁平的 id 陣列**。理由是後者每勾一次就變,若塞回節點資料就得重建整棵 `items`,而重建 `items` 會讓底層元件重建內部 store —— 權限矩陣每點一下都要付那個代價。
