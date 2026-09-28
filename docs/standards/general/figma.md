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

**`get_metadata` 不帶 nodeId 只列得出 Cover 頁**(這個檔如此):各元件頁 / 畫面頁的 frame id 進不去就找不到,一律記在下表。一列一個節點;新畫一個元件或畫面,就在該頁最後一列後面追加一列。

| 頁(頁 id)                         | 節點                                            | 節點 id                                    | 內容                                                                                                                        |
| --------------------------------- | ----------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Foundations                       | text style Badge                                | S:31877e31ddad0966032051e6a137691bb79cf701 | Public Sans Medium 12 / 行高 20(Badge 數字)                                                                                 |
| Foundations                       | text style Caption/SemiBold                     | S:8b7647c42d3eb03b86d7ef5569e8d1a6d528b97e | 12 / 600(SegmentedControl 選中)                                                                                             |
| Icons(244:2)                      | Draft/ModuleIcon                                | 244:92                                     | 29 個 `key=<name>` 變體                                                                                                     |
| Icons(244:2)                      | Draft/ActionIcon                                | 253:3264                                   | edit / delete / chevron-double-left / right(MUI Outlined)                                                                   |
| TextField(11:2)                   | Draft/DatePicker                                | 253:61                                     | Size=Small / Medium,TextField + 日曆圖示;說明卡 253:62                                                                      |
| TextField(11:2)                   | Draft/DateTimePicker                            | 286:25                                     | Size=Small / Medium,值 `YYYY-MM-DD HH:mm`                                                                                   |
| Select(70:219)                    | Draft/Autocomplete                              | 253:39                                     | State=Closed / Open,含 chip、分組 listbox、灰掉的不合格選項;說明卡 253:40                                                   |
| Tabs(70:220)                      | Draft/Tab                                       | 69:655                                     | 內距 10 / 8;BOOLEAN Badge(文字右側的 Draft/Badge 實例)                                                                      |
| Tabs(70:220)                      | Draft/Tabs                                      | 252:14                                     | 由 Draft/Tab 組成 + 底線;說明卡 252:23                                                                                      |
| Popover(73:2)                     | Draft/Tooltip                                   | 252:10                                     | Placement=Top / Bottom;說明卡 252:11                                                                                        |
| Pagination(76:723)                | Draft/PaginationItem                            | 76:728                                     | 32×32,字套 Subtitle/2                                                                                                       |
| Tag(76:711)                       | Draft/Tag                                       | 76:722                                     | 標籤                                                                                                                        |
| Switch                            | Draft/Switch                                    | 88:216                                     | On / Off(沒有停用變體,見下方待補稿)                                                                                         |
| Dialog                            | Draft/HelpDialog                                | 95:235                                     | 模組說明彈窗;畫面頁上的實例 81:241                                                                                          |
| Table(101:2)                      | Draft/Table                                     | 288:182                                    | `@repo/ui` Table:Size=Medium / Small × State=Data / Empty                                                                   |
| Table(101:2)                      | Draft/TableHeaderCell、Draft/TableCell          | 101:3 / 101:9                              | 字套 Subtitle/2、Body/2(14),高度 hug                                                                                        |
| Badge(285:2)                      | Draft/Badge                                     | 285:12                                     | Color=Primary / Default × Variant=Standard / Dot,TEXT Content;說明卡 285:13(0 不顯示、超過 99 顯示 99+、Dot 用於收合側欄)   |
| SegmentedControl(285:3)           | Draft/SegmentedOption                           | 286:7                                      | 單一選項,State=Selected / Default,TEXT Label                                                                                |
| SegmentedControl(285:3)           | Draft/SegmentedControl                          | 286:8                                      | 整組(示範三選項:淺色 / 深色 / 跟隨系統)                                                                                     |
| Menu(285:4)                       | Draft/MenuItem                                  | 287:22                                     | Variant=Menu / List × State=Default / Hover;BOOLEAN Icon + INSTANCE_SWAP Icon glyph                                         |
| Menu(285:4)                       | Draft/Menu                                      | 287:23                                     | 彈出層(radius/md、Shadow/Dropdown),內含三個 MenuItem                                                                        |
| Alert(289:2)                      | Draft/Alert                                     | 289:27                                     | 頁內提示 Severity=Info / Warning / Error / Success,TEXT Message                                                             |
| List(290:2)                       | Draft/ListItem                                  | 290:29                                     | 左側清單列:Primary / Secondary / Caption + 四個 tag 槽,State=Selected / Default                                             |
| Flow(302:2)                       | Draft/FlowStepNode                              | 302:27                                     | 流程設計器的審核關卡節點 240×104,State=Default / Selected / Error                                                           |
| Flow(302:2)                       | Draft/FlowJoinNode                              | 302:37                                     | 匯合節點 56×56 菱形,State=Default / Selected / Error                                                                        |
| Admin Shell(32:2)                 | Draft/NavItem                                   | 20:18                                      | 側欄項目;BOOLEAN Badge(右側的 Draft/Badge)                                                                                  |
| Admin Shell(32:2)                 | Draft/AdminSideNav                              | 30:52                                      | 展開側欄;系統管理群組備用槽 spare-1~~4(32:186、288:3543、288:3549、288:3555)、頂層備用槽 spare-top-1~~2(288:3762、288:3768) |
| Admin Shell(32:2)                 | Draft/AdminAppBar                               | 30:95                                      | orgSwitcher = SelectField 實例 276:131                                                                                      |
| Admin Shell(32:2)                 | Draft/AdminUserMenu                             | 278:77                                     | 頭像選單:使用者卡 275:78、外觀分段按鈕 275:88、語言分段按鈕 275:103、登出項 275:109 / 275:113                               |
| Admin Shell(32:2)                 | Draft/NavRailItem                               | 246:63                                     | 收合側欄項目:圖示槽 246:60、群組小點 246:62                                                                                 |
| Admin Shell(32:2)                 | Draft/AdminSideNavCollapsed                     | 246:64                                     | 收合側欄:logoImg 246:65、collapse-toggle 246:97;group-flyout 246:99                                                         |
| Screen / 角色管理                 | 角色管理                                        | 44:44                                      | 矩陣 57:142、頂層群組列 172:276 / 172:284、新增角色 62:169、清單列 67:180 / 67:182                                          |
| Screen / 資料範圍                 | 資料範圍                                        | 166:318                                    | 註記卡 167:1901、日期條件列 167:1804 / 167:1819、捲動提示 169:277                                                           |
| Screen / Admin 使用者管理(30:104) | Admin 使用者管理                                | 30:105                                     | 列動作:編輯 / 所屬組織 / 指派角色 / 複製組織與角色 / 停用或啟用;表格 31:82                                                  |
| Screen / Admin 使用者管理(30:104) | Overlay / 複製組織與角色                        | 305:441                                    | 彈窗本體 305:442:來源、目標、合併 / 取代、變更預覽、範圍外提示                                                              |
| Screen / Admin 模組與權限(89:2)   | Admin 模組與權限                                | 89:3                                       | 內容 89:214、詳情 89:245(引擎列 306:220、列表欄位配置列 306:225)                                                            |
| Screen / Admin 模組與權限(89:2)   | Overlay / 停用模組確認                          | 211:331                                    | ConfirmDialog                                                                                                               |
| Screen / Admin 模組與權限(89:2)   | Overlay / 列表欄位配置                          | 306:232                                    | 彈窗本體 306:233:摘要槽 / 表單欄位列、寬度、上移 / 下移 / 移除、內建欄開關                                                  |
| Screen / Admin 欄位管理(90:2)     | Admin 欄位管理                                  | 90:3                                       | 類別面板 90:215(新增類別、「系統」/「已停用」標籤、自訂類別列)                                                              |
| Screen / Admin 欄位管理(90:2)     | Admin 欄位管理 — 自訂類別                       | 305:5623                                   | 選中自訂類別時多「編輯類別」「停用類別」                                                                                    |
| Screen / Admin 欄位管理(90:2)     | Overlay / 新增欄位類別                          | 305:5979                                   | 彈窗本體 305:5980                                                                                                           |
| Screen / Admin 欄位管理(90:2)     | Overlay / 新增選項                              | 211:176                                    | 新增選項彈窗                                                                                                                |
| Screen / Admin 表單管理(292:2)    | Admin 表單管理 — 表單設計                       | 293:2                                      | 清單 + 詳情 + 設計器(元件庫 / 畫布 / 欄位屬性)+ 檢查結果;側欄收合                                                           |
| Screen / Admin 表單管理(292:2)    | Admin 表單管理 — 表單版本                       | 295:306                                    | 版本表 295:717(操作含「將舊版資料升級到此版」)+ 與上一版差異                                                                |
| Screen / Admin 表單管理(292:2)    | Overlay / 將舊版資料升級到此版 — 步驟 1 / 2 / 3 | 295:4355 / 295:4383 / 295:4398             | 彈窗本體 295:4356 / 295:4384 / 295:4399                                                                                     |
| Screen / Admin 流程管理(292:3)    | Admin 流程管理 — 流程設計                       | 303:2                                      | 清單 + 詳情 + 設計器工具列 + 流程圖(畫布 303:252)+ 問題清單 + 關卡編輯面板 303:306;側欄收合                                 |
| Screen / Admin 流程管理(292:3)    | Admin 流程管理 — 阻擋清單                       | 304:219                                    | 阻擋 / 需要推進頁籤、新增審核者 / 改派、重試推進;卡片 304:540                                                               |
| Screen / Admin 流程管理(292:3)    | Overlay / 改派                                  | 304:660                                    | 彈窗本體 304:661                                                                                                            |
| Screen / Admin 申請中心(292:4)    | Admin 申請中心 — 我的申請                       | 296:2                                      | 兩頁籤含 badge、篩選列、DataTable、分頁;側欄「申請中心」badge                                                               |
| Screen / Admin 申請中心(292:4)    | Admin 申請中心 — 待我審核                       | 296:523                                    | 處理狀態篩選、操作「審核」                                                                                                  |
| Screen / Admin 申請中心(292:4)    | Admin 申請中心 — 申請詳情                       | 297:431                                    | 唯讀表單 + 審核區 297:745(核准 / 駁回 / 退回修改、關卡進度、審核歷程)                                                       |
| Screen / Admin 申請中心(292:4)    | Overlay / 新申請                                | 298:586                                    | 彈窗本體 298:587(模組 / 表單)                                                                                               |
| Screen / Admin 申請中心(292:4)    | Overlay / 退回修改                              | 298:608                                    | 審核決定彈窗(理由必填),彈窗本體 298:609                                                                                     |
| Screen / Admin 示範表單(292:5)    | Admin 示範表單 — 列表                           | 299:2                                      | 工具列 + DataTable(列表欄位配置決定的欄 + 內建欄 + 操作)+ 分頁;表格 299:360                                                 |
| Screen / Admin 示範表單(292:5)    | Admin 示範表單 — 編輯                           | 300:252                                    | 新增 / 編輯共版型:帶入資料、退回提示、分區、明細列表格 300:570                                                              |
| Screen / Admin 示範表單(292:5)    | Admin 示範表單 — 檢視                           | 301:448                                    | 唯讀檢視:返回列表 / 修訂紀錄 / 刪除 / 編輯;明細列唯讀卡片 301:711                                                           |
| Screen / Admin 示範表單(292:5)    | Overlay / 修訂紀錄                              | 301:5342                                   | 彈窗本體 301:5343(含展開的「與前一修訂的差異」)                                                                             |

頁欄沒有 id 的,由同列的節點 id 直接進入。表裡沒有的頁,先問使用者要 frame id,不要靠猜的 id 去讀。畫面頁若與實作 / 模組文件不一致,照 FIGMA-10 處理:照文件做、在 PR 記差異。

Components 區凡是先有實作、後補稿的元件(Tooltip、DatePicker、DateTimePicker、Autocomplete、Tabs、ActionIcon、Badge、SegmentedControl、Menu、Table、Alert、ListItem),設計稿以實作為準。

**待補稿清單**(動設計檔前要先提案取得使用者同意,不要順手畫;補稿時以實作現況為準):

| 缺什麼                                         | 實作現況 / 說明                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Draft/Switch` 的停用變體                      | 停用態照語意 token 走:軌道 `action.disabledBackground`、把手 `action.disabled`,與 `Draft/Checkbox` 的停用稿(44:36、44:40)同一個調性 |
| `Draft/Badge` Color=Default 的配色             | 實作是 `grey[300]` 底 + `grey[800]` 字(theme 的 `MuiBadge` 覆寫);稿暫用 `action.selected` 底 + `text.primary`                       |
| `Draft/NavRailItem` 的待審小圓點               | `Draft/Badge` Variant=Dot 已備好,補稿時放進 NavRailItem                                                                             |
| `Draft/Button` 的 Color 軸                     | 畫面上的紅字 / 綠字按鈕(刪除、退役、停用、駁回、啟用)暫以覆寫文字色表示;實作是 MUI `color="error"` / `"success"`                    |
| IconButton(outlined)、Avatar、CircularProgress | 元件稿尚未建立                                                                                                                      |
| 流程管理其他畫面                               | 「流程版本」頁籤(版本表、發布中斷提示、差異);建立流程、分派、發布、退役、分流彈窗                                                   |
| 表單管理其他畫面                               | 建立表單、以此為基底建新表單、分派、發布新版本、退役、刪除草稿、刪除欄位 / 分區、解除流程綁定彈窗;預覽模式(帶入資料 / 以後端重算)   |
| 申請中心其他狀態                               | 撤回 / 作廢彈窗、阻擋時的提示、空狀態                                                                                               |
| 示範表單其他畫面                               | 帶入資料、選擇要填寫的表單、刪除確認彈窗、空狀態                                                                                    |
| 使用者管理、欄位管理、模組與權限三頁的側欄     | 仍是舊的示範側欄結構,尚未換成現行側欄                                                                                               |

## FIGMA-10 設計稿有標的幾何一律落到 theme;設計稿與模組文件衝突時以模組文件為準

- 元件的固定幾何(高度、圓角、內距、字級)只要 Figma 有標,就要寫進 `packages/ui` 的 theme 或元件,不要「MUI 預設看起來差不多」就跳過 — Button 的 32 / 36 / 48 高度少寫兩個,結果中文按鈕文字垂直偏上 1.25px。
- 設計稿與 `docs/modules/<key>.md` 說法不同時(欄位有無、動作放在按鈕還是彈窗內、核取方塊還是開關),**以模組文件為正本**,實作照文件做並在 PR 記差異,設計稿由主流程之後補齊。
- **設計稿與票上的文字不同時,以「較新者」為準,並在 PR 回報**:上一條處理的是「稿 vs 模組文件」,這一條處理「稿 vs 票」—— 票是照當時的稿寫的,稿之後被改過(或反之),兩邊就會各說一種文案 / 欄位名。判斷順序:①票或稿哪一份明確標了較新的日期 / 票號,取較新的;②看不出新舊時以**模組文件**裁決(上一條);③兩邊都沒寫就照票做。無論取哪一邊,PR 內文都要寫一行「稿寫 A、票寫 B,取 X 因為 Y」,讓主流程知道有一邊要補。**不要自己去改設計檔**(動 Figma 前要先提案取得同意)。
