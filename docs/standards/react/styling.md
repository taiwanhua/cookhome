# Styling(樣式)

適用:front / admin / ui 所有 React 元件。技術選型:MUI + Emotion(`sx` 為主),
theme 為唯一樣式來源(兩層 tokens:品牌層 → 語意層,見 `packages/ui/src/theme/`)。
選型討論見 dis.md(2026-09-05:評估過全轉 Tailwind 與 MUI+Tailwind 混用,皆否決 —
單一樣式系統對 AI 產碼與 review 最友善;Minimal Dashboard 級的統一感靠 theme 工程達成)。

## STYLE-01 禁魔法值:樣式值一律取自 theme

顏色、間距、圓角、字級、陰影、斷點不出現裸值(hex、rgb、裸 px)。
取用管道:語意 token(`theme.palette.*`)、`theme.spacing()`(sx 內寫數字即可,如
`p: 2`)、`theme.shape.borderRadius`、`theme.typography.*`、`theme.shadows[n]`。

例外:`0`、`1px`(邊框)、`100%` / `auto` 這類與品牌無關的佈局值。

## STYLE-02 `sx` 為主;重複第三次就抽

- 一次性樣式寫 `sx`;同樣的樣式組合用到**第三次**,抽成 styled 元件或收進 `@repo/ui`
- 禁 `style={}` inline style
- 禁新增 `.css` 檔(現存 `styles.css` 為鷹架殘留,元件 MUI 化時一併移除)

## STYLE-03 響應式只用 theme 斷點

用 `sx` 的斷點物件語法(`{ xs: ..., md: ... }`)或 `theme.breakpoints`;不手寫
`@media` 查詢。

## STYLE-04 深色模式只透過 palette

theme 已開 `cssVariables` + light/dark colorSchemes;元件不判斷「現在是深色嗎」、
不寫 `prefers-color-scheme` — 用對語意 token,深色模式自動正確。

## STYLE-05 apps 不直接 import MUI/Emotion(lint 強制)

front/admin 只從 `@repo/ui` 拿元件;`@mui/*`、`@emotion/*` 由
`no-restricted-imports` 擋下(`packages/config-eslint` 的 `designSystemWall`,
只套 apps,ui 套件自身可用)。缺的元件到 `packages/ui` 包一層再用 — 就算第一版
只是 re-export,也讓「哪些元件在系統裡」有唯一清單,版本與客製集中一處。

**包一層時碰到外部庫的型別擋路,換掉它的 slot 元件,不要 `as` 硬轉**(2026-09-20,#207 的邊界範例):
`RichTreeView` 的 `slotProps.checkbox` 只宣告成 `HTMLAttributes`,`indeterminate` / `disabled`
根本傳不進去。做法是 `slots={{ checkbox: TreeItemRowCheckbox }}` 換成自家的
`@repo/ui` `Checkbox`,狀態經 context 交給它(REACT-09)—— 順帶讓三態勾選框的外觀
與 admin 其他勾選框一致(原本直接吃 MUI 內建的那顆,長得不一樣)。
`as unknown as` 硬轉只是把錯誤推到執行期,而且下一版庫改型別就再撞一次。

**目前已知缺的元件**(缺的期間用原生替代並在 PR 記一筆,不要在 app 裡直接 import MUI):
`EditIcon` / `DeleteIcon` 與 `Tabs`(待 #254,角色管理頁先用文字按鈕與自組 `role="tablist"`)。
`Tooltip` 已補(#240 / #260,`@repo/ui/tooltip`):原生 `title` 的三處(`OrgActionBar`、
模組與權限頁的 self-lock 開關、AppBar 的「?」)都已改用它,**disabled 元素要包 `span`
才收得到 hover 這件事由元件內部處理**,呼叫端不要再自己包一層。

## STYLE-06 設計稿的值不在 token 裡時:一次性直寫並註記,重複兩處以上補 token

STYLE-01 禁裸值,但 Figma 常給 theme 沒有的值(Tag 字級 11px、Checkbox 圓角 5px、樹縮排 18px、上傳框虛線 1.5px)。裁決(2026-09-19,#131 / #132):

- 只有一個元件用到 → 元件內直寫字面值,**旁邊註記來源**(`// Figma Draft/Tag 76:722:11px,theme 最小 caption 12px`);
- 第二個元件也要同一個值 → 提升為 token(`src/theme/`),兩處都改用 token;
- 能用既有 token 近似而視覺差異可接受的(13px → `body2` 14px、18px 縮排 → MUI 預設)優先用 token,在 PR 記下差異。

## STYLE-07 ui 元件的預設樣式:`styled()` 或 theme `components` 覆寫,呼叫端 `sx` 只能疊加

包 MUI 的元件如果用 `<MuiX sx={defaultSx} {...props} />`,呼叫端傳一個 `sx` 就把預設整包蓋掉。規則:

- 元件的**幾何與 tone 這類必要預設**寫進 `styled()`(元件旁)或 `src/theme/create-theme.ts` 的 `components` 覆寫(全站一致的預設,如 MuiDialog / MuiPopover / MuiChip);
- 呼叫端的 `sx` 一律經 `mergeSx(defaultSx, props.sx)`(`src/theme/sx.ts`)疊在預設之上;
- **MUI 9 的 `sx` 不接受陣列**(`sx={[a, b]}` 型別錯),所以 `mergeSx` 是唯一的合併方式;`Stack` / `Box` 也不再收 `alignItems`、`minWidth`、`flex` 這類 system props,版面值一律進 `sx`。

## STYLE-08 admin 頁面的高度由殼給:滿版版面用 `flex: 1` + `minHeight: 0`,捲動容器自己標 `overflow: auto`

`ShellLayout` 外框 `height: 100vh` + `overflow: hidden`,`<main>` 是 column flex 且 `flex: 1; minHeight: 0; overflow: auto`,所以頁面拿到的是**確定的高度**。要做「左樹 / 右表格撐滿、各自捲動」的頁面:頁面根容器 `flex: 1; minHeight: 0`(不要 `alignItems: flex-start`),左右兩塊各自 column flex + 內層 `overflow: auto`。Figma 的 Screen frame 把等高與各自捲動畫得很清楚,但那個資訊在 frame 的 width / height 裡,不在截圖裡,實作前用 `get_metadata` 量(#183 的教訓:#138 / #139 兩頁都只撐到內容高度)。

## STYLE-09 `Stack spacing` 的直接子元素不要用 margin 做位移

`Stack spacing` 會對每個直接子元素下 `& > :not(style):not(style) { margin: 0 }`,優先序高過子元素自己的 `sx`,所以 `ml` / `mt` 會被歸零 — 寫了縮排、lint 綠、測試綠、畫面沒縮排,是最難自己發現的一類(#183 開通彈窗的模組勾選)。要位移就用 padding,或多包一層 `Box`。

## STYLE-10 從呼叫端看 `sx`:只疊加、不覆蓋幾何

app 端給 `@repo/ui` 元件傳 `sx` 時,只放與版面位置有關的值(`cursor`、`mt`、`flex`…);元件自己的幾何(高度、圓角、tone 色)由元件內的 `styled()` / theme `components` 決定(STYLE-07),呼叫端不要重設。需要不同尺寸或 tone 用元件的 props(`size`、`tone`),沒有就到 ui 加,不在呼叫端用 `sx` 硬改。
