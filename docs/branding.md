# 品牌註冊表

**規則:任何新增或異動「品牌文字、圖案、色彩、網域」的地方,必須同步更新本表**(新增列或修訂),否則換品牌時會漏。AI 與人同守;review 時檢查。

換品牌 = 逐列處理下表 + 主色一行(`createBrandFromPrimary` 的 hex)。

**不在本表的**:設計系統的通用圖示(`@repo/ui/icons` 的 `CloseIcon`、`HelpIcon` 等)—— 它們是介面元件、跟著 `currentColor` 走,換品牌不必逐一處理;本表只登記品牌**文字、圖案(商標 / favicon)、色彩、網域**。

## 程式碼

**瀏覽器儲存的 key 一律 kebab-case、以品牌 slug 開頭**:格式 `cookhome-<app>-<用途>`(需要分使用者時再加 `:<userId>`,如 `cookhome-admin-route-tabs:<userId>`),localStorage / sessionStorage / BroadcastChannel 共用這套命名。**不要用點分隔**(`cookhome.admin.sidenav`)—— 鑰匙混用兩種寫法時,換品牌 grep 一次抓不全。新增一把鑰匙就在下表補一列(key 帶品牌 slug,所以它是品牌元素)。

| 位置                                                                    | 內容                                                                                                                                                                                                                                                                                              | 怎麼改                                                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/theme/brand.ts`                                        | `cookhomeBrand`(主色來源,全 theme 由此衍生)                                                                                                                                                                                                                                                       | 換 primary hex 一行;export 名稱可 alias 保留                                                                            |
| `apps/storybook/.storybook/preview.tsx`                                 | import `cookhomeBrand`                                                                                                                                                                                                                                                                            | 隨上列改名連動                                                                                                          |
| `apps/admin/src/lib/locale.ts`                                          | localStorage key `cookhome-admin-locale`(AppBar 語言切換器寫入)                                                                                                                                                                                                                                   | 換品牌 slug(舊 key 的既存值會失效,可接受)                                                                               |
| `apps/api/src/app.module.ts`                                            | 預設 MongoDB 連線 `mongodb://localhost:27017/cookhome`                                                                                                                                                                                                                                            | 換 db 名(僅本機預設,正式環境走環境變數)                                                                                 |
| `apps/api/src/mail/mail-templates.ts`                                   | 信件(啟用信、重設密碼信、審核流程的任務 / 結果通知信):寄件人 `MAIL_SENDER` = `CookHome <no-reply@cookhome.online>`、品牌名「CookHome」(主旨前綴「【CookHome】」、內文「CookHome 後台帳號」)、署名「CookHome 後台管理系統」                                                                        | 改該檔頂部的 `MAIL_SENDER` / `BRAND_NAME` / `SIGNATURE` 三個常數;寄件網域須同步在 Resend 完成 SPF / DKIM 驗證(ADR-0010) |
| 網域                                                                    | `cookhome.online`、`design.cookhome.online`(deploy 設定 / DNS / Storybook 部署)                                                                                                                                                                                                                   | DNS + `.github/workflows/deploy.yml` 相關設定                                                                           |
| `apps/admin/index.html`                                                 | `<title>CookHome 後台管理</title>`(favicon 為 Vite 鷹架預設 `public/favicon.ico`,尚未換品牌圖)                                                                                                                                                                                                    | 換 title 文字 / 換 favicon 檔                                                                                           |
| `packages/i18n/messages/*/common.json` `brand`                          | 「CookHome」(admin 登入頁 LoginCard 品牌名、footer 的 {brand})                                                                                                                                                                                                                                    | 改兩語系的值                                                                                                            |
| `packages/i18n/messages/*/admin.json` `login.subtitle` / `login.footer` | 「後台管理系統」/「© {year} {brand} · 僅供授權人員使用」(對應 Figma LoginCard 17:8 / 17:26)                                                                                                                                                                                                       | 改兩語系的值                                                                                                            |
| `packages/i18n/messages/*/admin.json` `app.subtitle`                    | 「後台管理」(SideNav 頂部組織名稱下方的副標,對應 Figma AdminSideNav 25:43)                                                                                                                                                                                                                        | 改兩語系的值                                                                                                            |
| `apps/admin/src/app/AdminShell/SideNav/SideNav.tsx`                     | SideNav 頂部租戶識別:**有商標就顯示商標圖、沒有才顯示當前組織名稱**(Figma 120:50 的 ShowLogo 變體,28×28 圓角 6;`alt` = 組織名)。商標來自 `me.currentOrg.logoUrl`(api 現簽的短效網址,ADR-0010),**已接**;無當前組織時名稱退回 `common.brand`;側欄第一列「總覽」是模組 `overview`(seed),不是品牌文字 | 換槽位幾何改該檔的 `LOGO_SIZE` / `LOGO_RADIUS`;商標本身是租戶資料,由組織管理頁上傳                                      |
| `apps/admin/src/lib/auth/session-channel.ts`                            | BroadcastChannel 名稱 `cookhome-admin-session`(分頁間的登入狀態同步:登出、換帳號;同一條 channel 兩種訊息)                                                                                                                                                                                         | 換品牌 slug                                                                                                             |
| `apps/admin/src/lib/route-tabs.ts`                                      | sessionStorage key 前綴 `cookhome-admin-route-tabs`(路由頁籤列的保留,每使用者一把 `:<userId>`)                                                                                                                                                                                                    | 換品牌 slug(舊 key 的既存值會失效,可接受)                                                                               |
| `apps/admin/src/stores/useSideNavStore.ts`                              | localStorage key `cookhome-admin-sidenav`(側欄收合狀態,這台瀏覽器的偏好、不分使用者;同檔的 `LEGACY_SIDE_NAV_STORAGE_KEY` 把舊的點分隔 key `cookhome.admin.sidenav` 一次性搬過來)                                                                                                                  | 換品牌 slug(舊 key 的既存值會失效,可接受)                                                                               |
| 各 app metadata title / favicon(front)                                  | (實作畫面時逐一登記於此)                                                                                                                                                                                                                                                                          | —                                                                                                                       |

## [Figma:CookHome Design System](https://www.figma.com/design/SvnBvi8Opfj8daJAclOnWW)(Wowgo 團隊,fileKey `SvnBvi8Opfj8daJAclOnWW`)

| 位置                              | 節點                                                                                                                       | 內容                                                                                                                                                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin 登入 LoginCard              | 17:4(desktop)/ 17:5(mobile);文字 17:7 / 17:8 / 17:26                                                                       | 「CookHome」「後台管理系統」「© 2026 CookHome…」(忘記密碼、設定新密碼頁為其複本,共 4 張圖同步改)                                                                                                                                                    |
| Admin 忘記密碼 / 設定新密碼       | 忘記密碼 120:1533 / 120:1557;設定新密碼 120:1582(說明文字 120:1605、送出鈕 120:1589)/ 連結失效 121:1520(說明文字 121:1525) | LoginCard 複本;文案與 `admin.json` 的 `setPassword.description` / `setPassword.submit` / `setPassword.invalid.description` 一致                                                                                                                     |
| Draft/AdminSideNav 元件           | root 30:52;25:42(brandName)/ 120:50(logoImg 槽)                                                                            | 展開態(240 寬)。頂部租戶識別:預設文字,ShowLogo=true 換商標圖;改元件即全畫面連動;第一列「總覽」是模組(受授權),不是固定列;**底部靠右一顆收合開關「«」**(與收合態 246:97 同一顆按鈕的另一種對齊)                                                       |
| Draft/NavRailItem 元件            | 246:63(State=Default / Selected / Group);圖示槽 246:60、群組小點 246:62                                                    | 收合態的圖示列項目 40×40:圖示 20px 取自 `modules.icon` 白名單,Selected 用 primary.lighter 底 + primary.dark 圖示(與 Draft/NavItem 一致),Group 右上 6px 小點 = 點開有子選單;名稱以 Tooltip 顯示                                                      |
| Draft/AdminSideNavCollapsed       | 246:64;logoImg 246:65、collapse-toggle 246:97                                                                              | 收合態(64 寬):logo 只留圖、模組列只剩圖示、底部置中的展開開關「»」;與 Draft/AdminSideNav 為同一個元件的兩種寬度                                                                                                                                     |
| group-flyout(示意)                | 246:99                                                                                                                     | 收合態點群組彈出的子選單:200 寬、白底圓角陰影,群組名標題 + Draft/NavItem 列(實作用 `@repo/ui/popover`,圓角與陰影由 theme 的 MuiPopover 給)                                                                                                          |
| Draft/AdminAppBar 元件            | root 30:95;help-button 81:51、localeSwitcher 198:50、orgSwitcher 76:54、user-menu-trigger 20:54(頭像 + 姓名 + chevron)     | 頁名右側的「?」模組說明鈕(圖示 = `@repo/ui/icons` 的 `HelpIcon`,非品牌圖)、語言切換 Select(值 = `localeLabels`)、當前組織 Select、使用者選單觸發區;順序與程式一致                                                                                   |
| Draft/AdminUserMenu 元件          | 196:2129                                                                                                                   | 使用者選單:表頭姓名 + 帳號、項目「登出」「登出所有裝置」(文案 = `session.logout` / `session.logoutAllDevices`)                                                                                                                                      |
| Draft/AdminRouteTabs / RouteTab   | 34:33(頁籤列範例)/ 26:48(單一 tab,Closable 開關)                                                                           | 所有 tab 都可關(含「總覽」)                                                                                                                                                                                                                         |
| Draft/FrontAppBar                 | 36:4(Desktop)/ 38:5(Mobile)                                                                                                | 前台 logo 文字                                                                                                                                                                                                                                      |
| Draft/FrontFooter                 | 36:25 / 36:30(Desktop)、38:11 / 38:13(Mobile)                                                                              | 品牌名 + © 行                                                                                                                                                                                                                                       |
| Foundations / Cover               | —                                                                                                                          | 主色變數 `primary/*`(6:43–6:48)由主色衍生;Cover 頁標題                                                                                                                                                                                              |
| Icons 頁 / `Draft/ModuleIcon`     | Icons 頁 244:2;元件 `Draft/ModuleIcon` 244:92                                                                              | 模組圖示的 29 個變體(`key=<name>`,與 `packages/ui/src/icons/module-icon-registry.ts` 同名同順序)。**通用圖示不是品牌元素** — 這裡只記位置,換品牌不動它;新增圖示要登錄表與變體一起加                                                                 |
| Icons 頁 / `Draft/ActionIcon`     | Icons 頁 244:2;元件 `Draft/ActionIcon` 253:3264                                                                            | 殼與列表操作的 4 個變體(edit / delete / chevron-double-left / chevron-double-right),取自 `@mui/icons-material` Outlined = `packages/ui/src/icons/` 的同名檔。**通用圖示不是品牌元素**,只記位置                                                      |
| Components / `Draft/Autocomplete` | Select 頁 70:219;元件 253:39(說明卡 253:40)                                                                                | `@repo/ui/autocomplete`:chip 用 `primary.lighter` 底 + `primary.darker` 字。**色彩取自語意 token**,換品牌主色自動跟著變,不在這裡寫死                                                                                                                |
| Components / `Draft/SelectField`  | Select 頁 70:219;元件 262:39(State=Default / Error / Disabled)                                                             | `@repo/ui/select-field`:表單下拉 = outlined `TextField select`(浮動標籤 + 外框 + helperText),與既有 `Draft/Select` 的 outlined 變體同外觀。**色彩與幾何取自語意 token / theme**,不寫死;`Draft/Select` 的 standard 變體仍是 AppBar 的語言 / 組織切換 |
| Components / `Draft/Tabs`         | Tabs 頁 70:220;元件 252:14(由 `Draft/Tab` 69:655 組成,說明卡 252:23)                                                       | `@repo/ui/tabs`:選中的底線與字色 = `primary.main`。同上,語意 token 驅動。**使用處**:角色管理頁詳情(權限矩陣 / 分配使用者)與**組織管理頁詳情的「組織資料 / 成員」**(87:2)                                                                            |
| Components / `Draft/Snackbar`     | Popover 頁 73:2;元件 261:10                                                                                                | `@repo/ui/snackbar`:操作結果提示,`success` / `error` 兩個變體用 MUI Alert 的語意色,不寫死色碼。**右上角**(AppBar 下方)、4 秒自動關閉、長度 1 的佇列(只顯示最新一則);文案與呼叫慣例的正本見 `docs/standards/react/data-fetching.md` DATA-06          |
| Components / `Draft/Tooltip`      | Popover 頁 73:2;元件 252:10(說明卡 252:11)                                                                                 | `@repo/ui/tooltip`:`grey[800]` 底 + `shape.borderRadius`(theme 的 `MuiTooltip` 覆寫)                                                                                                                                                                |
| Components / `Draft/DatePicker`   | TextField 頁 11:2;元件 253:61(說明卡 253:62)                                                                               | `@repo/ui/date-picker`:外觀 = outlined `TextField` + 日曆鈕,幾何由 theme 的 `MuiOutlinedInput` 供給                                                                                                                                                 |
| Components / `Draft/DataTable`    | Table 頁 101:2;元件節點待主流程畫完回填                                                                                    | `@repo/ui/data-table`:表頭 / 儲存格沿用 `Draft/TableHeaderCell` 101:3、`Draft/TableCell` 101:9 的樣式;固定欄與捲動區交界的分隔陰影、表頭右緣的欄寬把手(hover / 聚焦 / 拖拉中為 `primary.main`)**取自語意 token**,不寫死色碼                         |

| Screen / Admin 表單管理 | 待回填 | 表單管理頁(`system.forms`):左側表單清單、右側標頭動作與「設計 / 版本」頁籤。色彩與幾何取自語意 token |
| Draft/FormDesigner | 待回填 | 設計器:元件面板 / 畫布(設計模式的欄位格與分區放置區,選取框 `primary.main`)/ 屬性面板 / JSON 預覽 / 檢查結果 |
| Draft/FormVersionPanel | 待回填 | 版本面板:草稿與各版本列、發布(變更說明)、發布中斷重試、退役目前版本、與上一版差異 |
| Overlay / 分派跳窗 | 待回填 | 勾選租戶 = 分派、取消勾 = 收回 |
| Overlay / 以此為基底建新表單 | 待回填 | 基底版本、表單 key(建立後不可改)、名稱 |
| Screen / Admin 模組與權限:列表欄位配置 | 待回填 | 表單模組的右面板區塊 + 設定跳窗(摘要槽 / 表單欄位、排序、欄寬) |
| Overlay / 退役權限清理 | 待回填 | 退役欄位級權限清單(名稱、表單、欄位、使用筆數)與三層檢查的確認 |
| Screen / Admin 表單模組列表 | 待回填 | 預設組裝的列表頁(搜尋、表單 / 狀態篩選、DataTable、新增鈕) |
| Screen / Admin 表單模組新增編輯 | 待回填 | `FormRenderer` 填寫模式 + 帶入資料鈕 + 存草稿 / 送出 |
| Overlay / 帶入資料跳窗 | 待回填 | 來源下拉 → 搜尋結果 → 對應表勾選(「會覆蓋」提示) |
| Screen / Admin 表單模組詳情 | 待回填 | 唯讀渲染、附件下載、修訂紀錄與差異 |
| Draft/FormDesigner:預覽模式 | 待回填 | 設計器的「設計 / 預覽」切換;預覽以 `FormRenderer` 填寫模式即時跑條件與計算,「以後端重算」後以 api 結果為準 |
| Draft/FormPicker | 待回填 | 表單選擇下拉(多表單模組的新增 / 列表篩選) |
| Overlay / 刪欄位確認跳窗 | 待回填 | 列出引用這個欄位的地方(公式 / 條件 / 摘要槽 / 帶入規則 / 列表欄位配置)後確認 |
| Overlay / 刪分區二選一跳窗 | 待回填 | 欄位移到未放置區,或連同欄位一起刪除(後者列出分區外的引用處) |
| Draft/ExpressionPicker | 待回填 | 表達式選擇器:公式、顯示 / 唯讀條件、自訂驗證的樹狀編輯 |
| Overlay / 建立表單跳窗 | 待回填 | 表單 key(建立後不可改)、名稱、所屬模組 |
| Overlay / 編輯表單跳窗 | 待回填 | 表單 key(唯讀)、名稱、頁籤標題範本 |
| Overlay / 發布跳窗 | 待回填 | 變更說明、檢查器錯誤就地列出;設計器有未存的變更時提示並提供「先存草稿」 |
| Overlay / 退役確認跳窗 | 待回填 | 退役目前版本前的確認 |
| Draft/ListColumnRow | 待回填 | 列表欄位配置跳窗裡的欄位列編輯(種類、欄位、欄寬、排序) |
| Screen / Admin 組織管理:主管欄 | 待回填 | 組織詳情的「主管」列(停用的標註)與編輯彈窗的主管多選 |
| Screen / Admin 流程管理 | 待回填 | 流程管理頁(`system.workflows`):左側流程清單(共用 / 客製、版本、分派數、綁定表單)、右側標頭動作與「設計 / 版本」頁籤、頁首「阻擋清單」 |
| Draft/WorkflowDesigner | 待回填 | 流程設計器:頂列(檢查用表單 + 說明 + 「檢查」鈕、修訂號、未存、加一關、存草稿)/ 流程圖(React Flow,dagre 直式排版)/ 屬性面板 / 檢查結果 / JSON 預覽 |
| Draft/ReviewStepNode | 待回填 | 審核關卡卡片:名稱、審核者來源、會簽、跳過條件、不可退回;選中 `primary.main`、有錯 `error.main` 外框 |
| Draft/JoinNode | 待回填 | 匯合節點菱形(系統節點,無屬性) |
| Draft/StepEditor | 待回填 | 關卡屬性面板:名稱、key、審核者來源四種、會簽、允許退回、跳過條件、加關卡 / 分流 / 移動 / 刪除 |
| Draft/JoinPanel | 待回填 | 匯合節點屬性面板:說明(系統節點、N 條分支都通過才完成)、名稱、加一條分支、在匯合後加一關、刪除整組分流 |
| Draft/UsersField / UserPicker | 待回填 | 「指定使用者」多選(關鍵字丟回 api 查、已選的保留)與改派用的單選(停用 / 申請人 / 已在本關的人灰掉並就地寫原因) |
| Draft/WorkflowVersionPanel | 待回填 | 流程版本面板:草稿與各版本列、發布、發布中斷重試、退役、與上一版差異、檢視 vN、刪除草稿 |
| Draft/FlowCheckPanel | 待回填 | 「檢查」的結果面板:依關卡分組列錯誤 / 警告(點一筆定位到那一關)、沒選檢查用表單的提示、檢查後又修改的提示 |
| Draft/FlowVersionViewer | 待回填 | 唯讀檢視已發布 / 退役的流程版本:唯讀提示、檢查用表單(停用)+ 「檢查」、以此為基底開新草稿、關閉檢視、流程圖與唯讀屬性面板 |
| Screen / Admin 阻擋清單 | 待回填 | 隱藏頁 `system.workflows.blocked-page`:阻擋 / 需要推進頁籤、清單(表單、標題、申請人、卡在哪、最後變動)、改派 / 新增審核者 / 重試推進 |
| Draft/WorkflowBindingField | 待回填 | 表單管理右側的流程綁定欄:下拉、不能直接綁的原因與「建客製流程」、「綁定的流程已失效」 |
| Screen / Admin 申請中心 | 待回填 | `apply-center`:「我的申請」/「待我審核」兩頁籤(DataTable + 篩選)與右上「新申請」 |
| Screen / Admin 申請中心詳情 | 待回填 | 隱藏頁 `apply-center.view-page`:修訂快照唯讀渲染 + 審核區塊 |
| Draft/ApprovalSection | 待回填 | 提交詳情下方的審核區塊:實例狀態、阻擋提示、我的任務動作、撤回 / 作廢 / 複製為新單、關卡 / 分支進度、時間軸 |
| Draft/SubmissionStatusTag | 待回填 | 提交狀態 chip 七值(草稿 / 審核中 / 審核中(待處理)/ 已退回 / 已撤回 / 已完成 / 已駁回 / 已作廢),表單模組列表與詳情、申請中心共用 |
| Screen / Admin 表單模組列表:審核狀態 | 待回填 | 列表狀態欄七值、綁流程的已完成只有「作廢」 |
| Overlay / 審核決定跳窗 | 待回填 | 核准(意見選填)/ 駁回 / 退回修改(理由必填) |
| Overlay / 撤回申請 | 待回填 | 撤回確認(還沒有人審過才能撤回) |
| Overlay / 作廢 | 待回填 | 作廢理由(必填)與確認 |
| Overlay / 改派 / 新增審核者 | 待回填 | 選一位使用者;申請人與已在本關的人灰掉並寫原因 |
| Overlay / 從此關分流 | 待回填 | 選分支數(2–5) |
| Overlay / 發布流程 | 待回填 | 變更說明、檢查器錯誤就地列出、未存變更提示「先存草稿」 |
| Overlay / 退役流程版本 | 待回填 | 退役目前版本前的確認(綁定的表單送出會被擋) |
| Overlay / 刪除流程草稿 | 待回填 | 刪除草稿前的確認(已發布版本不受影響;設計器有未存變更時提醒一起丟掉) |
| Overlay / 解除流程綁定 | 待回填 | 警告「進過審核的單再送出會被擋」 |
| Overlay / 流程未存變更 | 待回填 | 換流程前:留在設計 / 放棄變更 / 先存草稿 |
| Overlay / 新申請 | 待回填 | 選模組 → 選表單 → 前往填寫 |
| Overlay / 建立流程 / 改名稱 | 待回填 | 流程 key(建立後不可改)、名稱 |
| Overlay / 流程分派 | 待回填 | 勾選租戶 = 分派、取消勾 = 收回 |
| Overlay / 以此為基底建流程 | 待回填 | 基底版本、新流程 key、名稱 |

## 資料

| 位置                 | 內容                                | 說明                                                                                  |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `orgs`(根組織)`name` | 「CookHome」                        | AppBar orgSwitcher、清單等顯示的是組織名稱(資料),換品牌時改根組織名                   |
| `orgs.logoPath`      | 各組織商標的 GCS 物件路徑(nullable) | 租戶自有商標;SideNav 頂部 ShowLogo 顯示(API 簽名讀取,ADR-0010),無值則顯示組織名稱文字 |
