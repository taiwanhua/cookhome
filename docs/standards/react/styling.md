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
