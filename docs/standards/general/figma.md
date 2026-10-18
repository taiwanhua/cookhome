# Figma 設計稿規範

適用:底座與引用專案的 Figma 設計稿(人與 AI 同守)。檔案、品牌 Library 與採用狀態以 [設計資源登記](../../branding.md#設計資源登記) 為入口;共用元件放底座檔,品牌及客製畫面放專案檔。

## FIGMA-01 元件的家

- **通用原子**(Button、TextField、Checkbox、Select、Tabs、Dialog…)一元件一頁,放 Components 區
- **殼與情境元件**(SideNav、AppBar、RouteTabs、StatCard / RecipeCard、AdSlot…)放對應 Shell 頁
- 尚未 code 化的元件一律 `Draft/` 前綴;code 化並重新投影後移除前綴
- 元件必填 description(用途 + 特殊規則),重要操作屬性化(TEXT/BOOLEAN 屬性)
- **變體軸與屬性名對應 `@repo/ui` 包裝層的 props**;包裝層能透傳 MUI 原生值就透傳、不發明新名(如 Select 的 Variant=Outlined/Standard 即 MUI variant),真有 MUI 沒有的才自定義(STYLE-05)

## FIGMA-02 零寫死

顏色綁變數(`setBoundVariableForPaint`)、字型套 text styles、陰影套 effect styles、圓角綁 radius 變數。文件頁的裝飾文字除外。

共用導覽列、頁籤與 SelectField 的中文及下拉符號使用 Noto Sans TC，字重沿原值；這是程式字型堆疊已有的中文備援。Library 實例的文字內容存在不代表字形可見，發布後以引用專案的代表畫面核對中文、符號及排版，避免只核對字串而漏掉缺字。

## FIGMA-03 畫面 = 實例組合

畫面由殼實例 + 元件實例組成;每頁差異用**實例覆寫**(改字、換色、visible、swap 變體),禁止 detach。結構性增減用「備用槽 + visible」模式(側欄備用列、RouteTabs 8 槽)。

## FIGMA-04 文案守詞彙表

UI 文字嚴格遵守 `CONTEXT.md` 與 `CONTEXT-PROJECT.md`(使用者/會員/組織…,禁用詞不出現);**對人的提示文字禁用內部術語**(「子樹」→「或其下層組織」)。中文為主,識別符(key、email)除外。**受眾分層**:租戶使用者可見的畫面與 help 文案不得出現平台視角詞彙(根組織/租戶/開通/跨租戶);聯絡窗口統一「系統管理員」;平台詞彙僅限根組織專屬畫面(模組與權限)與根組織視角示範圖。

## FIGMA-05 陰影容器不裁切

放置帶陰影元素(卡片、按鈕、彈窗)的 auto-layout 容器一律 `clipsContent: false` — 預設裁切會把柔影切成直角(本專案已踩三次)。

## FIGMA-06 畫面完整性

動筆前先盤流程:CRUD 齊全、關聯操作入口、確認彈窗、空/錯誤狀態 — 缺口先列給使用者拍板。表格必有表頭與分頁;彈窗畫成遮罩 + 對話框的畫面,背景是打開它的頁面(FIGMA-12);既有底座 Overlay 畫面(只有半透黑底、沒有背後頁面)回收到底座後依此規則重畫。多狀態並列示範。動筆前的盤點與 FIGMA-17「畫之前」一起做。

## FIGMA-07 RWD

front 畫面三檔 artboard(1440 / 768 / 375,斷點對應 MUI lg/md/xs);admin 的底座參考畫面單檔 1440 + 表格橫向捲動,專案後台畫面畫電腦 / 平板 / 手機三種尺寸(FIGMA-11)。front 殼元件用 `Device=Desktop/Mobile` 變體;專案後台三種尺寸的殼與共用區塊用 `Size` 變體(FIGMA-11)。

## FIGMA-08 Plugin API 慣例(AI 產稿)

批次綁定時 placeholder 色放解析後的值(佔位灰會黏著);遍歷實例隱藏子節點先 `figma.skipInvisibleInstanceChildren = false`;`resize` 會把 HUG 變 FIXED,事後補回;變數/元件 id 記錄於 session 狀態檔。

## FIGMA-09 給 AI 的指路:節點 id 要給元件 frame,不是頁

Figma MCP 的 `get_design_context(nodeId)` 對「頁(canvas)」的 id 會直接報錯,要先 `get_metadata(pageId)` 找到元件 frame 的 id 再讀。票或文件引用設計稿時,寫元件 frame 的 id(如 Draft/Tag 76:722),頁的 id(如 Tag 頁 76:711)只當索引。

**`get_metadata` 不帶 nodeId 只列得出 Cover 頁**(這個檔如此):各元件頁 / 畫面頁的 frame id 進不去就找不到,一律記在下表。一列一個節點;新畫一個元件或畫面,就在該頁最後一列後面追加一列。

### 底座共用元件與樣式

下表使用 [wowgo-base Design System](https://www.figma.com/design/XKQ18kf6SkfAQYk7GmBkk5) 的節點。Library 採用狀態與品牌檔位置見 [設計資源登記](../../branding.md#設計資源登記)。

| 頁(頁 id)                  | 節點                                   | 節點 id                                    | 內容                                                                                                                                                                                                                                                                                             |
| -------------------------- | -------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foundations                | text style Badge                       | S:2ff780ac04604ae7a990dd8dad49f97275ebd7b7 | Public Sans Medium 12 / 行高 20(Badge 數字)                                                                                                                                                                                                                                                      |
| Foundations                | text style Caption/SemiBold            | S:7cfa2be1b685e1bf7c2d32270742cbf2e41d61d2 | 12 / 600(SegmentedControl 選中)                                                                                                                                                                                                                                                                  |
| Button(8:2)                | Button                                 | 2001:111                                   | 變體軸 Color=Primary / Error / Success × Variant × Size × State;Error 變體 2001:148–2001:182(contained 底 error/main、字 error/contrastText、Shadow/Error;outlined 框與字 error/main;text 字 error/main);Success 變體 2001:184–2001:218(同上換 success/*、Shadow/Success,對應 `color="success"`) |
| Icons(244:2)               | Draft/ModuleIcon                       | 2001:4                                     | 29 個 `key=<name>` 變體                                                                                                                                                                                                                                                                          |
| Icons(244:2)               | Draft/ActionIcon                       | 2001:68                                    | 八個變體:edit / delete / chevron-double-left / chevron-double-right / view / add 2001:81 / arrow-up 2001:83 / arrow-down 2001:85(MUI Outlined),向量綁 `grey/700`                                                                                                                                 |
| TextField(11:2)            | Draft/DatePicker                       | 2001:302                                   | Size=Small / Medium,TextField + 日曆圖示;說明卡 2001:311                                                                                                                                                                                                                                         |
| TextField(11:2)            | Draft/DateTimePicker                   | 2001:314                                   | Size=Small / Medium,值 `YYYY-MM-DD HH:mm`                                                                                                                                                                                                                                                        |
| Select(70:219)             | Draft/Autocomplete                     | 2001:391                                   | State=Closed / Open,含 chip、分組 listbox、灰掉的不合格選項;說明卡 2001:429                                                                                                                                                                                                                      |
| Tabs(70:220)               | Draft/Tab                              | 2001:599                                   | 內距 10 / 8;BOOLEAN Badge(文字右側的 Draft/Badge 實例)                                                                                                                                                                                                                                           |
| Tabs(70:220)               | Draft/Tabs                             | 2001:610                                   | 由 Draft/Tab 組成 + 底線;說明卡 2001:615                                                                                                                                                                                                                                                         |
| Popover(73:2)              | Draft/Tooltip                          | 2001:980                                   | Placement=Top / Bottom;說明卡 2001:989                                                                                                                                                                                                                                                           |
| Pagination(76:723)         | Draft/PaginationItem                   | 2001:506                                   | 32×32,字套 Subtitle/2                                                                                                                                                                                                                                                                            |
| Tag(76:711)                | Draft/Tag                              | 2001:463                                   | 標籤                                                                                                                                                                                                                                                                                             |
| Switch(88:211)             | Draft/Switch                           | 2001:369                                   | State=On / Off × Enabled=True / False(停用 2001:374 / 2001:376:軌道 `action/disabledBackground`、把手 `action/disabled`,對應 `@repo/ui` Switch 的 `.Mui-disabled`;與 Draft/Checkbox 的 Enabled 軸同一做法)                                                                                       |
| Upload(121:2)              | Draft/UploadField                      | 2001:565                                   | State=Empty / Preview;Empty 提示 2001:571 =「PNG / JPG / WebP,建議正方形,2MB 以內」;Preview 既有檔顯示「目前的商標」、不顯示大小                                                                                                                                                                 |
| Dialog                     | Draft/HelpDialog                       | 2001:926                                   | 模組說明彈窗;底座參考畫面的實例 2022:2757,專案畫面實例 [CookHome 81:241](https://www.figma.com/design/SvnBvi8Opfj8daJAclOnWW?node-id=81-241)                                                                                                                                                     |
| Table(101:2)               | Draft/Table                            | 2001:737                                   | `@repo/ui` Table:Size=Medium / Small × State=Data / Empty                                                                                                                                                                                                                                        |
| Table(101:2)               | Draft/TableHeaderCell、Draft/TableCell | 2001:630 / 2001:632                        | 字套 Subtitle/2、Body/2(14),高度 hug                                                                                                                                                                                                                                                             |
| Badge(285:2)               | Draft/Badge                            | 2001:478                                   | Color=Primary / Default × Variant=Standard / Dot,TEXT Content;Default 底 `grey/300`、字 `grey/800`(2001:482 / 2001:483 / 2001:484);說明卡 2001:485(0 不顯示、超過 99 顯示 99+、Dot 用於收合側欄)                                                                                                 |
| SegmentedControl(285:3)    | Draft/SegmentedOption                  | 2001:516                                   | 單一選項,State=Selected / Default,TEXT Label                                                                                                                                                                                                                                                     |
| SegmentedControl(285:3)    | Draft/SegmentedControl                 | 2001:521                                   | 整組(示範三選項:淺色 / 深色 / 跟隨系統)                                                                                                                                                                                                                                                          |
| Menu(285:4)                | Draft/MenuItem                         | 2001:1004                                  | Variant=Menu / List × State=Default / Hover;BOOLEAN Icon + INSTANCE_SWAP Icon glyph                                                                                                                                                                                                              |
| Menu(285:4)                | Draft/Menu                             | 2001:1021                                  | 彈出層(radius/md、Shadow/Dropdown),內含三個 MenuItem                                                                                                                                                                                                                                             |
| Alert(289:2)               | Draft/Alert                            | 2001:942                                   | 頁內提示 Severity=Info / Warning / Error / Success,TEXT Message;BOOLEAN Action(預設關,右側 Button text/small 2001:949 / 2001:956 / 2001:963 / 2001:970,對應 MUI Alert 的 action)                                                                                                                 |
| List(290:2)                | Draft/ListItem                         | 2001:1100                                  | 左側清單列:Primary / Secondary / Caption + 四個 tag 槽,State=Selected / Default                                                                                                                                                                                                                  |
| Flow(302:2)                | Draft/FlowStepNode                     | 2001:1129                                  | 流程設計器的審核關卡節點 240×104,State=Default / Selected / Error                                                                                                                                                                                                                                |
| Flow(302:2)                | Draft/FlowJoinNode                     | 2001:1151                                  | 匯合節點 56×56 菱形,State=Default / Selected / Error                                                                                                                                                                                                                                             |
| IconButton(311:5813)       | Draft/IconButton                       | 2001:538                                   | Variant=Plain(圓形 30 / 40 / 52)/ Outlined(方形 32 / 40 / 48、divider 框、radius/sm)× Size=Small / Medium / Large;INSTANCE_SWAP Icon(Draft/ActionIcon);說明卡 2001:551                                                                                                                           |
| Avatar(311:5814)           | Draft/Avatar                           | 2001:497                                   | Size=32 / 40,`primary/lighter` 底 + `primary/dark` 字,TEXT Initial;說明卡 2001:502                                                                                                                                                                                                               |
| CircularProgress(311:5815) | Draft/CircularProgress                 | 2001:529                                   | 40×40、`primary/main` 3/4 圈;說明卡 2001:531                                                                                                                                                                                                                                                     |
| Admin Shell(32:2)          | Draft/NavItem                          | 2001:1187                                  | 側欄項目;BOOLEAN Badge(右側的 Draft/Badge)                                                                                                                                                                                                                                                       |
| Admin Shell(32:2)          | Draft/AdminSideNav                     | 2001:1214                                  | 展開側欄;系統管理群組備用槽 spare-1~~4(2001:1227、2001:1228、2001:1229、2001:1230)、頂層備用槽 spare-top-1~~2(2001:1242、2001:1243)                                                                                                                                                              |
| Admin Shell(32:2)          | Draft/AdminAppBar                      | 2001:1248                                  | orgSwitcher = SelectField 實例 2001:1254                                                                                                                                                                                                                                                         |
| Admin Shell(32:2)          | Draft/AdminUserMenu                    | 2001:1312                                  | 頭像選單:使用者卡 2001:1313、外觀分段按鈕 2001:1323、語言分段按鈕 2001:1338、登出項 2001:1344 / 2001:1348                                                                                                                                                                                        |
| Admin Shell(32:2)          | Draft/NavRailItem                      | 2001:1282                                  | 收合側欄項目:圖示槽 2001:1290、群組小點 2001:1291;BOOLEAN Badge 只在 Default / Selected(badge-dot 2001:1285 / 2001:1288,8×8 圓心落在圖示右上角);Group 不畫待審點                                                                                                                                 |
| Admin Shell(32:2)          | Draft/AdminSideNavCollapsed            | 2001:1295                                  | 收合側欄:logoImg 2001:1296、collapse-toggle 2001:1304、頂層備用槽 spare-top-1 2001:1301(description)/ spare-top-2 2001:1302(mail)(預設隱藏);group-flyout 2001:1306                                                                                                                               |
| Admin Shell(32:2)          | RouteTabs / 子頁籤說明                 | 2001:1352                                  | 詳情子頁籤命名(所屬模組名 — 檢視・/ 編輯・/ 新增・項目名)、刪除後關閉同一筆的子頁籤;Draft/AdminRouteTabs 的 tab-9(2001:1270)為子頁籤示範                                                                                                                                                         |

### 底座後台參考畫面

底座治理、表單、流程與示範模組的中性參考畫面位於 wowgo-base Design System,節點索引見[底座 FIGMA-09](https://github.com/taiwanhua/wowgo-base/blob/v0.2.0/docs/standards/general/figma.md#底座後台參考畫面)。參考畫面與下表的 CookHome 畫面分別維護,不能用底座節點 ID 操作專案檔案。

### CookHome 舊檔節點

下表是保留的 [CookHome Design System](https://www.figma.com/design/SvnBvi8Opfj8daJAclOnWW) 舊檔節點。現行後台畫面位於 [CookHome Screens](https://www.figma.com/design/Wi9DIhrSILy2bj9nqXb051)；兩檔節點 id 不可混用。修改現行畫面時保留元件實例連結,共用元件回到底座維護。

| 頁(頁 id)                         | 節點                                            | 節點 id                               | 內容                                                                                                                                                                                                                                                        |
| --------------------------------- | ----------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screen / 角色管理                 | 角色管理                                        | 44:45                                 | 矩陣 57:142、頂層群組列 172:276 / 172:284、新增角色 62:169、清單列 67:180 / 67:182                                                                                                                                                                          |
| Screen / Admin 組織管理(87:2)     | Overlay / 編輯組織                              | 88:167                                | 彈窗本體 88:168(租戶視角編輯租戶頂層):名稱、描述、頂層不可搬移說明 334:8404(無上層下拉)、商標(Preview「目前的商標」)、主管 329:511、租戶短碼 329:7262、擁有者 329:7264、可見範圍開關、時區欄 326:7689(未設定)                                               |
| Screen / Admin 組織管理(87:2)     | Overlay / 編輯組織(已選時區)                    | 326:7702                              | 彈窗本體 326:7703;頂層不可搬移說明 334:8427(無上層下拉)、時區 Europe/London(326:7713)、主管 329:541、租戶短碼 329:7266、擁有者 329:7268                                                                                                                     |
| Screen / Admin 組織管理(87:2)     | Overlay / 編輯組織(根組織)                      | 334:8436                              | 彈窗本體 334:8437:名稱、描述、商標、時區;無上層 / 主管 / 租戶短碼 / 擁有者 / 可見範圍                                                                                                                                                                       |
| Screen / 資料範圍                 | 資料範圍                                        | 166:319                               | 註記卡 167:1901、日期條件列 167:1804 / 167:1819、捲動提示 169:277                                                                                                                                                                                           |
| Screen / Admin 使用者管理(30:104) | Admin 使用者管理                                | 30:105                                | 側欄 30:106;列動作 Button text/small(314:611–314:659):編輯 / 所屬組織 / 指派角色 / 複製組織與角色 / 停用(Color=Error)或啟用(Color=Success 314:649);表格 31:82                                                                                               |
| Screen / Admin 使用者管理(30:104) | Overlay / 複製組織與角色                        | 305:441                               | 彈窗本體 305:442:來源、目標、合併 / 取代、變更預覽、範圍外提示                                                                                                                                                                                              |
| Screen / Admin 模組與權限(89:2)   | Admin 模組與權限                                | 89:3                                  | 側欄 89:4、內容 89:214、詳情 89:245(引擎列 306:220、圖示列 314:954、列表欄位配置列 306:225)                                                                                                                                                                 |
| Screen / Admin 模組與權限(89:2)   | Overlay / 停用模組確認                          | 211:331                               | ConfirmDialog(確認鈕 Color=Error)                                                                                                                                                                                                                           |
| Screen / Admin 模組與權限(89:2)   | Overlay / 列表欄位配置                          | 306:232                               | 彈窗本體 306:233:摘要槽 / 表單欄位列、寬度、上移 / 下移 / 移除、內建欄開關                                                                                                                                                                                  |
| Screen / Admin 欄位管理(90:2)     | Admin 欄位管理                                  | 90:3                                  | 側欄 90:4;類別面板 90:215;選項表(租戶視角):表頭 顯示名稱 / 值 / 排序 / 來源 / 啟用 / 操作;啟用欄 Draft/Switch(種子列 Enabled=False 336:398–336:402,自訂列可切 336:404);操作欄:可編輯列 Button text/small「編輯」、種子列「由系統管理員維護」(text/disabled) |
| Screen / Admin 欄位管理(90:2)     | Admin 欄位管理 — 自訂類別                       | 305:5623                              | 根組織視角:選中自訂類別時多「編輯類別」「停用類別」;來源「CookHome 自訂」、啟用欄 Switch 可切(336:406–336:410)、操作 Button text/small「編輯」;他組織的選項操作欄顯示「由 … 管理」;側欄 305:5624                                                            |
| Screen / Admin 欄位管理(90:2)     | Overlay / 新增欄位類別                          | 305:5979                              | 彈窗本體 305:5980                                                                                                                                                                                                                                           |
| Screen / Admin 欄位管理(90:2)     | Overlay / 新增選項                              | 211:176                               | 新增選項彈窗                                                                                                                                                                                                                                                |
| Screen / Admin 表單管理(292:2)    | Admin 表單管理 — 表單設計                       | 293:2                                 | 清單 + 詳情 + 設計器(元件庫 / 畫布 / 欄位屬性)+ 檢查結果。畫稿隱藏側欄只是畫稿寬度處理(註記 319:547),程式照常顯示側欄                                                                                                                                       |
| Screen / Admin 表單管理(292:2)    | Admin 表單管理 — 表單設計:預覽                  | 319:550                               | 設計器的「預覽」:提示 + 帶入資料 / 以後端重算 + 表單 + 後端結果提示(DesignerPreview 319:785)                                                                                                                                                                |
| Screen / Admin 表單管理(292:2)    | Admin 表單管理 — 表單版本                       | 295:306                               | 版本表 295:717(操作含「將舊版資料升級到此版」)+ 與上一版差異                                                                                                                                                                                                |
| Screen / Admin 表單管理(292:2)    | Overlay / 將舊版資料升級到此版 — 步驟 1 / 2 / 3 | 295:4355 / 295:4383 / 295:4398        | 彈窗本體 295:4356 / 295:4384 / 295:4399                                                                                                                                                                                                                     |
| Screen / Admin 表單管理(292:2)    | Overlay / 建立表單、以此為基底建新表單、分派    | 320:662 / 320:715 / 320:768           | CreateFormDialog / ForkFormDialog / AssignFormDialog                                                                                                                                                                                                        |
| Screen / Admin 表單管理(292:2)    | Overlay / 發布新版本、退役目前版本、刪除草稿    | 320:815 / 320:863 / 320:896           | PublishDialog(含未存變更提示 + 先存草稿)/ RetireDialog / DeleteDraftDialog                                                                                                                                                                                  |
| Screen / Admin 表單管理(292:2)    | Overlay / 刪除欄位、刪除分區、解除流程綁定      | 320:929 / 320:966 / 320:1010          | DeleteFieldDialog(引用清單)/ DeleteSectionDialog / UnbindWorkflowDialog                                                                                                                                                                                     |
| Screen / Admin 流程管理(292:3)    | Admin 流程管理 — 流程設計                       | 303:2                                 | 清單 + 詳情 + 設計器工具列 + 流程圖(畫布 303:252)+ 問題清單 + 關卡編輯面板 303:306;側欄收合                                                                                                                                                                 |
| Screen / Admin 流程管理(292:3)    | Admin 流程管理 — 流程版本                       | 317:448                               | 版本表(發布 / 刪除草稿 / 檢視 / 退役 / 與上一版差異)+ 差異區(WorkflowVersionPanel 317:800)                                                                                                                                                                  |
| Screen / Admin 流程管理(292:3)    | Admin 流程管理 — 流程版本(發布中斷)             | 317:900                               | 發布中斷提示 + 重試發布;鎖定時只剩檢視 / 差異(317:1222)                                                                                                                                                                                                     |
| Screen / Admin 流程管理(292:3)    | Admin 流程管理 — 阻擋清單                       | 304:219                               | 阻擋 / 需要推進頁籤、新增審核者 / 改派、重試推進;卡片 304:540                                                                                                                                                                                               |
| Screen / Admin 流程管理(292:3)    | Overlay / 改派                                  | 304:660                               | 彈窗本體 304:661                                                                                                                                                                                                                                            |
| Screen / Admin 流程管理(292:3)    | Overlay / 建立流程、以此為基底建流程、分派      | 318:722 / 318:757 / 318:800           | WorkflowNameDialog / ForkWorkflowDialog / AssignWorkflowDialog                                                                                                                                                                                              |
| Screen / Admin 流程管理(292:3)    | Overlay / 發布、退役、刪除草稿、分流            | 318:836 / 318:872 / 318:894 / 318:917 | PublishWorkflowDialog / RetireWorkflowDialog / DeleteWorkflowDraftDialog / ForkDialog                                                                                                                                                                       |
| Screen / Admin 申請中心(292:4)    | Admin 申請中心 — 我的申請                       | 296:2                                 | 兩頁籤含 badge、篩選列、DataTable、分頁;側欄「申請中心」badge                                                                                                                                                                                               |
| Screen / Admin 申請中心(292:4)    | Admin 申請中心 — 我的申請(側欄收合)             | 316:616                               | 收合側欄(rail 316:910):申請中心選中 + 待審小圓點                                                                                                                                                                                                            |
| Screen / Admin 申請中心(292:4)    | Admin 申請中心 — 我的申請(空狀態)               | 316:966                               | 表格空狀態(316:1362)、共 0 筆、頁籤與側欄 badge 隱藏                                                                                                                                                                                                        |
| Screen / Admin 申請中心(292:4)    | Admin 申請中心 — 待我審核                       | 296:523                               | 處理狀態篩選、操作「審核」                                                                                                                                                                                                                                  |
| Screen / Admin 申請中心(292:4)    | Admin 申請中心 — 申請詳情                       | 297:431                               | 唯讀表單 + 審核區 297:745(核准 / 駁回 / 退回修改、關卡進度、審核歷程)                                                                                                                                                                                       |
| Screen / Admin 申請中心(292:4)    | Admin 申請中心 — 申請詳情(待處理)               | 316:1364                              | 審核中(待處理)提示 + 重試推進(316:1650)、找不到審核者的關卡                                                                                                                                                                                                 |
| Screen / Admin 申請中心(292:4)    | Overlay / 新申請                                | 298:586                               | 彈窗本體 298:587(模組 / 表單)                                                                                                                                                                                                                               |
| Screen / Admin 申請中心(292:4)    | Overlay / 退回修改                              | 298:608                               | 審核決定彈窗(理由必填),彈窗本體 298:609                                                                                                                                                                                                                     |
| Screen / Admin 申請中心(292:4)    | Overlay / 撤回申請、作廢                        | 315:607 / 315:634                     | ReasonDialog(撤回不需理由、作廢理由必填;確認鈕 Contained Error)                                                                                                                                                                                             |
| Screen / Admin 示範表單(292:5)    | Admin 示範表單 — 列表                           | 299:2                                 | 工具列 + DataTable(列表欄位配置決定的欄 + 內建欄 + 操作)+ 分頁;表格 299:360                                                                                                                                                                                 |
| Screen / Admin 示範表單(292:5)    | Admin 示範表單 — 列表(空狀態)                   | 321:1056                              | 表格空狀態、共 0 筆(表格 321:1069)                                                                                                                                                                                                                          |
| Screen / Admin 示範表單(292:5)    | Admin 示範表單 — 新增                           | 321:646                               | 新增頁(與編輯共版型,無退回提示);頁籤列 321:650 子頁籤「示範表單(頂層) — 新增・採購申請單」(模板無值時退回表單名)                                                                                                                                            |
| Screen / Admin 示範表單(292:5)    | Admin 示範表單 — 編輯                           | 300:252                               | 帶入資料、退回提示、分區、明細列表格 300:570(列動作 IconButton + ActionIcon add / arrow-up / arrow-down,321:621–321:642);頁籤列 300:453 子頁籤「示範表單(頂層) — 編輯・採購申請單」                                                                         |
| Screen / Admin 示範表單(292:5)    | Admin 示範表單 — 檢視                           | 301:448                               | 唯讀檢視:返回列表 / 修訂紀錄 / 刪除 / 編輯;明細列唯讀卡片 301:711;頁籤列 301:649:示範列表 + 檢視(選中)+ 編輯子頁籤(「示範表單(頂層) — 檢視・/ 編輯・項目名」)                                                                                               |
| Screen / Admin 示範表單(292:5)    | Overlay / 修訂紀錄                              | 301:5342                              | 彈窗本體 301:5343(含展開的「與前一修訂的差異」)                                                                                                                                                                                                             |
| Screen / Admin 示範表單(292:5)    | Overlay / 帶入資料 — 選資料、勾選欄位           | 322:949 / 322:1055                    | LookupDialog 兩步(搜尋結果;已選 + 欄位勾選 + 會覆蓋提示)                                                                                                                                                                                                    |
| Screen / Admin 示範表單(292:5)    | Overlay / 選擇要填寫的表單、刪除這筆資料        | 322:1133 / 322:1220                   | FormPicker / DeleteSubmissionDialog(確認鈕 Contained Error)                                                                                                                                                                                                 |

頁欄沒有 id 的,由同列的節點 id 直接進入。表裡沒有的頁,先問使用者要 frame id,不要靠猜的 id 去讀。畫面頁若與實作 / 模組文件不一致,照 FIGMA-10 處理:照文件做、在 PR 記差異。

Components 區凡是先有實作、後補稿的元件(Tooltip、DatePicker、DateTimePicker、Autocomplete、Tabs、ActionIcon、Badge、SegmentedControl、Menu、Table、Alert、ListItem、IconButton、Avatar、CircularProgress),設計稿以實作為準。

**待補稿與待決定清單**(動設計檔前要先提案取得使用者同意,不要順手畫;補稿時以實作現況為準):

| 項目               | 實作現況 / 待決定                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| 表單設計器畫布寬度 | 清單 320 + 元件庫 180 + 屬性 360 固定寬,1440 寬時畫布約 412px;設計模式要不要收起左側清單待決定 |

## FIGMA-10 設計稿有標的幾何一律落到 theme;設計稿與模組文件衝突時以模組文件為準

- 元件的固定幾何(高度、圓角、內距、字級)只要 Figma 有標,就要寫進 `packages/ui` 的 theme 或元件,不要「MUI 預設看起來差不多」就跳過 — Button 的 32 / 36 / 48 高度少寫兩個,結果中文按鈕文字垂直偏上 1.25px。
- 設計稿與 `docs/modules/<key>.md` 說法不同時(欄位有無、動作放在按鈕還是彈窗內、核取方塊還是開關),**以模組文件為正本**,實作照文件做並在 PR 記差異,設計稿由主流程之後補齊。
- **設計稿與票上的文字不同時,以「較新者」為準,並在 PR 回報**:上一條處理的是「稿 vs 模組文件」,這一條處理「稿 vs 票」—— 票是照當時的稿寫的,稿之後被改過(或反之),兩邊就會各說一種文案 / 欄位名。判斷順序:①票或稿哪一份明確標了較新的日期 / 票號,取較新的;②看不出新舊時以**模組文件**裁決(上一條);③兩邊都沒寫就照票做。無論取哪一邊,PR 內文都要寫一行「稿寫 A、票寫 B,取 X 因為 Y」,讓主流程知道有一邊要補。**不要自己去改設計檔**(動 Figma 前要先提案取得同意)。

## FIGMA-11 專案後台畫面畫三種尺寸,共用區塊用同一個元件實例

- **尺寸**:專案後台畫面一律畫電腦 1440 / 平板 1024 / 手機 390。模組頁由上到下三個 Section「電腦 1440」「平板 1024」「手機 390」,平板 / 手機的框名加「 · 平板」「 · 手機」。修一個尺寸時,其他尺寸與背景複本的同類問題一起修。
- **每張畫面 = 一個視窗尺寸**:畫面寬等於所在尺寸 Section 的寬度(非尺寸 Section,例如 58mm 單據,不在此限);同一個編號有多個對話框時拆成各自的畫面(遮罩 + 對話框,編號加 a / b / c),精靈的每一步畫成完整畫面,不並排在同一張框裡。
- **共用區塊用元件實例**:標題列、頂部列、側欄、app bar、卡片、格子、Stepper 這類三種尺寸都出現的區塊,用同一個元件的實例,尺寸差異做成元件的 `Size` 變體(電腦 / 平板 / 手機;和 front 殼元件的 `Device=Desktop/Mobile` 是不同用途,見 FIGMA-07);要改就改元件,不在單張畫面手改或手畫框。
- **三尺寸內容一致**:同一個畫面編號在三種尺寸的標題列按鈕要一樣;平板 / 手機放不下的按鈕可以收進「更多」,但入口要看得到。手機逐張對電腦,資訊與排序不能少;手機不出現水平捲動(表格這類例外要有明確的捲動區)。版面本來就不同的寫進稽核設定的例外並附理由。
- **篩選**:有 [篩選] 按鈕的平板 / 手機畫面,要嘛有自己的篩選抽屜畫面(名稱含「篩選」),要嘛框外註解寫明照共用的篩選規則。
- **確認視窗大小**:只有一兩句話、沒有表單欄位的確認視窗,手機也畫成置中的小視窗(寬 342,按鈕在視窗底部);有表單欄位、或內容是長清單 / 明細的才畫成全螢幕(app bar 用 `Kind=Dialog`)。

自動檢查:`audit-sync.js` 的 `syncDiffs`、`sharedHandDrawn`、`sectionMismatch`、`filterDrawerMissing` 要是 0,`exempted` 照列理由(FIGMA-17)。

## FIGMA-12 版面:對齊、不裁切、撐滿、蓋滿

- **對齊**:同一列的欄位上緣、高度一致;同一欄的標籤寬度一致;區塊之間的間距用同一組 token。同一容器裡上下堆疊的列,間距一致,列高改變後要重排。
- **不裁切**:標籤、按鈕、表頭、Chip 的文字不能被外框裁掉或遮住;文字層用 auto width 或 fill,不要固定寬度又關掉換行;外框不靠 clip content 藏住超出的內容(陰影容器另見 FIGMA-05)。元件實例裡的文字要在最近一層有填色或框線的父框裡,直屬父框是 auto layout 時也要在內距內;固定尺寸的小框放不下時,改內距 / 尺寸或讓文字換行,不要擠出內距。
- **撐滿**:欄位與表格用 fill container 撐滿父層,不手寫寬度;改完重新檢查父層是 auto layout;子節點不超出父框。列表 + 詳情、類別 + 選項這類兩欄頁面,兩欄都撐到畫面底部(等高);工作區(畫布 + 屬性面板)撐到面板底部,右側屬性面板 / 關卡面板滿版;表單設計器的檢查結果放在左側版面那一欄的底部(同流程設計器)。有殼的畫面高度 = 內容高度,至少一個視窗高。
- **不蓋字**:元件不蓋到其他文字。彈出選單、通知清單這類本來就蓋在頁面上的浮層,節點名稱含「浮層」;浮層本身不算,浮層裡面的元件蓋到浮層內的文字照樣算。不要用改父層的方式躲過檢查。
- **可捲動的分頁列**:放不下的分頁列單列橫向捲動,有更多分頁的那一側放漸層 + ‹ / ›(圖層名 `scroll-edge:start` / `scroll-edge:end`),選到的分頁捲進可視範圍;外框名稱含「可捲動」,裡面超出的分頁不算裁切。
- **對話框背景是打開它的頁面**:遮罩 + 對話框 / 抽屜 / 底部面板的畫面,背景放入口畫面的副本(同一份示範資料;圖層名「背景:<入口畫面>」,鎖定)再蓋 scrim(黑、不透明度 50%),不能只有灰底。scrim、全螢幕對話框、背景從頂到底、左到右蓋滿畫面框;抽屜從頂到底;底部面板貼齊畫面底部;背景頁變高時跟著撐滿。

自動檢查:`audit-layout.js` 的 `clippedText`、`misalignedRows`、`overflowNodes`、`overlapText`、`overflowTextInInstance`、`rowGapInContainer`,`audit-sync.js` 的 `overlayNoPage`、`overlayNotCovering`,`audit.js` 的 `baseScreensNotFromRef`(兩欄沒填滿)要是 0。

## FIGMA-13 顏色只綁共用色票,一個顏色一個意思

- 顏色一律綁共用色票變數(底座 Library、專案 Brand Library),不自創顏色(FIGMA-02);遮罩的黑 50% 是固定色例外。
- 同一顏色在一個模組只有一個意思。分類色用 `tagPalettes`;狀態色(info / success / warning / error)只表狀態。
- 專案頁綁專案品牌色,不留底座主色;底座草稿頁與底座參考畫面只綁底座變數。Library 還沒有的過渡變數放本機 `Draft/` 集合,回收到底座後改綁 Library 同名變數。

自動檢查:`audit-legend.js` 的 `unboundColors`,`audit-layout.js` / `audit.js` 的 `basePrimaryBindings`,`audit.js` 的 `nonBaseBindingsInBaseDrafts`、`nonBaseInBaseScreens` 要是 0;`draftTokenBindings` 回收前只回報,回收後要是 0。

## FIGMA-14 圖例和畫面標示一一對應

- 畫面上每個顏色、圖示、符號、線型(實線 / 虛線)都要在同一張畫面的圖例找到外觀一樣的項目;圖例的每一項在這個畫面都會出現。
- 圖例樣本用真實的圖例項目元件實例,和畫面上的標示同一外觀(實心就實心、虛線就虛線)。
- 同一個元件狀態用在不同畫面時,圖例文字可以依那個畫面的意思改寫,顏色和狀態仍一對一。

自動檢查:`audit-legend.js` 的 `legendMismatch` 要是 0(以解析後的實際色值比對)。「意思一致」腳本查不到,每次截圖逐張對。

## FIGMA-15 元件:用實例、先盤點、互動狀態照 MUI

- 用底座 Library / 草稿元件的實例,不 detach(FIGMA-03);新元件先對照 Library 有沒有同功能的元件,有就沿用。
- 小標籤用標籤元件,不拿大元件改字湊。
- 共用元件設計 props 前先盤點所有使用處(狀態集合、各處文字、可否點選):顏色與狀態固定在元件,文字由使用處傳入。
- **互動狀態照 MUI**:滑過 = 原底色上疊同色系 main × `hoverOpacity`(8%;同一節點第二層填色、綁變數 + paint 不透明度),框換同色系 main;已選取 = 疊 main × `selectedOpacity`(16%)+ 1px main 框(框不佔版面)。色系對照:長條用 primary;白底與 grey 底用 grey/500;Warning 用 warning/main;Error 用 error/main。不新增變數、不寫死色碼;換綁顏色時保留 paint 不透明度。
- **提示一律用 Snackbar**:操作結果、可撤銷的動作、新通知提示用 Snackbar 元件(電腦 / 平板右下角、手機底部滿寬),不畫頂部黑底提示。

## FIGMA-16 示範資料一致且算得起來

- 同一份示範資料在各檢視、各尺寸與背景複本一致(同一個組織、同一筆單、同一組數字)。
- 示範資料算得起來:合計、差額、比率可以驗算;流水編號從 001 起;名詞照名詞表(FIGMA-04)。

自動檢查:跨畫面資料比對用 `audit-crossview.js`,比對規則(參考畫面、比對欄位)由專案寫在稽核設定的 `crossView`;`total` 要是 0。

## FIGMA-17 畫圖流程:先找現有、改前列範圍、改後全部重跑

**畫之前**(與 FIGMA-06 的流程盤點一起做)

- **先找現有畫面 / 元件並截圖對照**,以現有為底只畫差異:底座參考畫面先複製現有的 `Screen / Admin …` 畫面(側欄、頁首、分頁、卡片、表格、欄位、按鈕、對話框樣式都沿用)再套改動,框外註解第一行寫「對應現有畫面:<框名>」;專案頁的外殼、列表、表單也要和底座現有樣式一致,不另組一套;用詞沿用現有畫面。
- 列畫面清單與「入口 → 畫面」對照;頁面依操作流程分列,入口旁放它打開的畫面。每張畫面列出它對應的規格章節。
- 列出影響範圍:規格章節、三種尺寸的畫面、元件、入口對照、畫面清單、畫圖腳本;共用區塊先改元件。

**畫面框內只放使用者看得到的內容**:設計稿編號、規格章節號、權限 key、錯誤碼、開發用說明寫在框外的註解文字(名稱「<畫面名> · 註解」)。使用者操作時需要的提示留在畫面裡;系統規則與實作說明搬到框外;一句裡兩種都有時,畫面留使用者那一半、整句原文放框外。只有畫面差很多的才另畫「權限不足」版本,其他在框外註解寫「- 權限:沒有 `<權限>` 權限時看不到 [按鈕]」,和規格同一句。

**改之後**(全部通過才能回報):

1. **全部頁面重跑自動檢查**,不能只跑有改的頁;用 [`scripts/figma-audit/`](../../../scripts/figma-audit/README.md) 的**完整腳本**(整份貼上,不貼精簡版)。子代理回報的稽核數字,協調者要自己用完整腳本重跑。
2. **人工核對**:入口與它打開的畫面都有;三種尺寸同步;名詞符合名詞表;示範數字算得起來;用不到的節點已刪;逐項核對規格的欄位、按鈕、權限、錯誤狀態;規格、畫面清單、入口對照、畫圖腳本與文件已和 Figma 現況一起更新。
3. **有改到的畫面逐張截圖**。
4. **回報**附每頁自動檢查的原始數字與人工核對結果,做不到的明說。

自動檢查:`audit.js` 的 `devTextInScreens`、`canvasOverlap`、`baseScreensNotFromRef` 要是 0。各腳本的執行方式、每項數字的意思與設定檔欄位見 [figma-audit README](../../../scripts/figma-audit/README.md)。
