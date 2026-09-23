# Figma 設計稿規範

適用:CookHome Design System 檔案內的一切繪製(人與 AI 同守)。檔案結構:Cover → Foundations → ─── Components ───(每元件一頁)→ Shell 頁(Admin Shell / Front Shell)→ ─── Screens ───(每畫面一頁)。

## FIGMA-01 元件的家

- **通用原子**(Button、TextField、Checkbox、Select、Tabs、Dialog…)一元件一頁,放 Components 區
- **殼與情境元件**(SideNav、AppBar、RouteTabs、StatCard / RecipeCard、AdSlot…)放對應 Shell 頁
- 尚未 code 化的元件一律 `Draft/` 前綴;code 化並重新投影後移除前綴
- 元件必填 description(用途 + 特殊規則),重要操作屬性化(TEXT/BOOLEAN 屬性)
- **變體軸與屬性名對應 `@repo/ui` 包裝層的 props**;包裝層能透傳 MUI 原生值就透傳、不發明新名(如 Select 的 Variant=Outlined/Standard 即 MUI variant),真有 MUI 沒有的才自定義(STYLE-05)

## FIGMA-02 零寫死

顏色綁變數(`setBoundVariableForPaint`)、字型套 text styles、陰影套 effect styles、圓角綁 radius 變數。文件頁的裝飾文字除外。

## FIGMA-03 畫面 = 實例組合

畫面由殼實例 + 元件實例組成;每頁差異用**實例覆寫**(改字、換色、visible、swap 變體),禁止 detach。結構性增減用「備用槽 + visible」模式(側欄備用列、RouteTabs 8 槽)。

## FIGMA-04 文案守詞彙表

UI 文字嚴格遵守 `CONTEXT.md`(使用者/會員/組織…,禁用詞不出現);**對人的提示文字禁用內部術語**(「子樹」→「或其下層組織」)。中文為主,識別符(key、email)除外。**受眾分層**:租戶使用者可見的畫面與 help 文案不得出現平台視角詞彙(根組織/租戶/開通/跨租戶);聯絡窗口統一「系統管理員」;平台詞彙僅限根組織專屬畫面(模組與權限)與根組織視角示範圖。

## FIGMA-05 陰影容器不裁切

放置帶陰影元素(卡片、按鈕、彈窗)的 auto-layout 容器一律 `clipsContent: false` — 預設裁切會把柔影切成直角(本專案已踩三次)。

## FIGMA-06 畫面完整性

動筆前先盤流程:CRUD 齊全、關聯操作入口、確認彈窗、空/錯誤狀態 — 缺口先列給使用者拍板。表格必有表頭與分頁;彈窗以 Overlay frame(半透黑底)示範放畫面頁旁;多狀態並列示範。

## FIGMA-07 RWD

front 畫面三檔 artboard(1440 / 768 / 375,斷點對應 MUI lg/md/xs);admin 單檔 1440 + 表格橫向捲動。殼元件用 `Device=Desktop/Mobile` 變體。

## FIGMA-08 Plugin API 慣例(AI 產稿)

批次綁定時 placeholder 色放解析後的值(佔位灰會黏著);遍歷實例隱藏子節點先 `figma.skipInvisibleInstanceChildren = false`;`resize` 會把 HUG 變 FIXED,事後補回;變數/元件 id 記錄於 session 狀態檔。

## FIGMA-09 給 AI 的指路:節點 id 要給元件 frame,不是頁

Figma MCP 的 `get_design_context(nodeId)` 對「頁(canvas)」的 id 會直接報錯,要先 `get_metadata(pageId)` 找到元件 frame 的 id 再讀。票或文件引用設計稿時,寫元件 frame 的 id(如 Draft/Tag 76:722),頁的 id(如 Tag 頁 76:711)只當索引。

**`get_metadata` 不帶 nodeId 只列得出 Cover 頁**(這個檔如此):所以各元件頁 / 畫面頁的 frame id **進不去就找不到**,一律記在這裡,新畫一頁就補一列:

| 頁                     | 進得去的 frame id                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components / Dialog    | Draft/HelpDialog 95:235(模組說明彈窗 81:241 是它在畫面頁的實例)                                                                                           |
| Screen / 角色管理      | 44:44(頁面主體;矩陣 57:142、頂層群組列 172:276 / 172:284、新增角色 62:169、清單列 67:180 / 67:182)                                                        |
| Screen / 模組與權限    | 89:2(主畫面 89:214、停用確認 211:331)                                                                                                                     |
| Screen / 資料範圍      | 166:318(註記卡 167:1901、日期條件列 167:1804 / 167:1819、捲動提示 169:277)                                                                                |
| Screen / 欄位管理      | 90:2(新增選項 211:176)                                                                                                                                    |
| Components / Select    | Select 頁 70:219;Draft/Autocomplete 253:39(State=Closed / Open,含 chip、分組 listbox、灰掉的不合格選項)+ 說明卡 253:40                                    |
| Components / Tabs      | Tabs 頁 70:220;Draft/Tabs 252:14(由 Draft/Tab 69:655 組成 + 底線)+ 說明卡 252:23                                                                          |
| Components / Popover   | Popover 頁 73:2;Draft/Tooltip 252:10(Placement=Top / Bottom)+ 說明卡 252:11                                                                               |
| Components / TextField | TextField 頁 11:2;Draft/DatePicker 253:61(Size=Small / Medium,TextField + 日曆圖示)+ 說明卡 253:62                                                        |
| Icons                  | 244:2(頁索引);元件 Draft/ModuleIcon 244:92(29 個 `key=<name>` 變體)、Draft/ActionIcon 253:3264(edit / delete / chevron-double-left / right,MUI Outlined)  |
| Screen / Admin Shell   | Draft/NavRailItem 246:63(圖示槽 246:60、群組小點 246:62)、Draft/AdminSideNavCollapsed 246:64(logoImg 246:65、collapse-toggle 246:97)、group-flyout 246:99 |

表裡沒有的頁,先問使用者要 frame id,不要靠猜的 id 去讀。上表的畫面頁若與實作 / 模組文件不一致,照 FIGMA-10 處理:照文件做、在 PR 記差異。

**待補稿清單(動設計檔前要先提案取得使用者同意,不要順手畫)**:

| 缺什麼                             | 實作現況(補稿時以此為準)                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Draft/Switch` 88:216 沒有停用變體 | 只有 On / Off 兩個變體。實作的停用態照語意 token 走:軌道 `action.disabledBackground`、把手 `action.disabled`,與 `Draft/Checkbox` 的停用稿(44:36、44:40)同一個調性 |

`Tooltip` / `DatePicker` / `Autocomplete` / `Tabs` / `ActionIcon` 五張稿(節點 id 見上表)**都是先有實作後補稿**,所以設計稿以實作為準。

## FIGMA-10 設計稿有標的幾何一律落到 theme;設計稿與模組文件衝突時以模組文件為準

- 元件的固定幾何(高度、圓角、內距、字級)只要 Figma 有標,就要寫進 `packages/ui` 的 theme 或元件,不要「MUI 預設看起來差不多」就跳過 — Button 的 32 / 36 / 48 高度少寫兩個,結果中文按鈕文字垂直偏上 1.25px。
- 設計稿與 `docs/modules/<key>.md` 說法不同時(欄位有無、動作放在按鈕還是彈窗內、核取方塊還是開關),**以模組文件為正本**,實作照文件做並在 PR 記差異,設計稿由主流程之後補齊。
- **設計稿與票上的文字不同時,以「較新者」為準,並在 PR 回報**:上一條處理的是「稿 vs 模組文件」,這一條處理「稿 vs 票」—— 票是照當時的稿寫的,稿之後被改過(或反之),兩邊就會各說一種文案 / 欄位名。判斷順序:①票或稿哪一份明確標了較新的日期 / 票號,取較新的;②看不出新舊時以**模組文件**裁決(上一條);③兩邊都沒寫就照票做。無論取哪一邊,PR 內文都要寫一行「稿寫 A、票寫 B,取 X 因為 Y」,讓主流程知道有一邊要補。**不要自己去改設計檔**(動 Figma 前要先提案取得同意)。
