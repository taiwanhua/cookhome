# 底座跨專案維護與同步計畫

本文件只保留尚未完成的 Figma 與跨 repo 同步工作。現有行為見下列正式文件;實作進度、驗收及部署結果以 issue/PR 為準。

## 正式文件入口

- [架構與維護歸屬](../architecture.md#底座與專案的維護歸屬):底座核心、專案內容與固定組裝。
- [前端架構](../concepts/frontend-architecture.md)、[資料層](../concepts/data-layer-and-isolation.md)、STRUCT-12:頁面、help、API 與資料登記契約。
- [設定交付](../concepts/data-layer-and-isolation.md#種子資料與遷移)、[操作](../deployment.md#設定與資料更新)、ADR-0002:seed/migration 來源、受管定義、更新與重置。
- [初始化操作](../agents/project-bootstrap.md)、[初始化索引](../project-initialization.md)、[品牌註冊表](../branding.md)、[部署](../deployment.md):專案值、設定來源與操作。
- [Figma 隔離測試](../branding.md#隔離品牌相容性測試):測試資產、可重現結果與限制。

接手先讀 `CLAUDE.md`、[協作規則](../agents/collaboration.md)、負責的 issue 全文與留言。未定介面依 [issue tracker](../agents/issue-tracker.md) 固定規格後才進 Ready;本計畫不代表外部資源已建立或工具已啟用。完成的內容依 STRUCT-11 歸入既有正本並從本計畫移除。

## E:Figma 品牌與版本同步

本節是 E 未完成工作的共用規格。原檔現況與可導航節點見 [CookHome 品牌註冊表](https://github.com/taiwanhua/cookhome/blob/main/docs/branding.md#figma-現況盤點);既有小型隔離實測見本 repo 的[品牌註冊表](../branding.md#隔離品牌相容性測試)。正式拆檔、通用工具與全元件驗收都尚未完成。

### 檔案與維護歸屬

| 目標檔案                 | 底座負責                                                                  | 專案負責                                                                             |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| wowgo-base Design System | 共用元件、固定語意色、字型、圓角、後台殼、治理及示範參考畫面;保留預設橘色 | 透過實例使用;專案客製不覆寫主元件                                                    |
| 專案 Brand Library       | 品牌推導、變數語意與生成工具契約                                          | 從既有專案品牌輸入生成自己的顏色與品牌陰影;登記自己的品牌資產                        |
| 專案畫面檔               | 提供可持續更新的共用元件來源                                              | 業務畫面、客製治理畫面及其實例覆寫;CookHome 的 Front Shell、食譜卡片與前台首頁屬此類 |

底座治理參考畫面放共用檔的 Screens 區,不能只抽原子元件而丟失完整後台藍本。專案若客製治理畫面,對應既有 `app/project/page-replacements.ts` 的維護邊界,仍保留底座原版。原檔的業務 POC 不抽進底座。

設計稿統一 Light,每個品牌使用自己的 Library,不占用底座 mode。原檔目前的 Color/Light、Dark 保持原狀;本工作不刪 Dark、不修改應用外觀切換。第一個正式遷移採分批清單,不得在搬移同時重畫元件、批次移除 Draft 或換整套命名。

### 沿用的程式來源與語意對照

| Figma 投影                                                      | 唯一程式來源                                                                          | 邊界                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 品牌名稱與主色輸入                                              | `packages/project-config/src/project/public.ts` 的 `projectPublic.brand`              | 人工只維護既有 name、primary,不新增手填六色設定                        |
| `Brand/primary/*` 及 `Color/primary/*`                          | `packages/ui/src/theme/brand.ts` 的 `createBrandFromPrimary`                          | lighter/light/main/dark/darker;Figma 的 contrast 對應程式 contrastText |
| `Shadow/Primary`                                                | `createCustomShadows(primaryMain).primary`,位於 `theme/tokens.ts`                     | 必須隨品牌生成及補套;只換 fill/stroke 不算完成                         |
| Primitives、Radius、固定 text/background/action、文字及其他陰影 | `theme/tokens.ts`、`theme/create-theme.ts`                                            | error/success 等狀態色與陰影不隨專案主色改                             |
| 共用元件與變體                                                  | `packages/ui/package.json` exports、`src/<元件>/<元件>.tsx`、同目錄 stories           | 不把 44 個公開子路徑等同 44 個圖形元件;hook/provider 不要求另畫        |
| 後台殼與流程節點                                                | `apps/admin/src/app/AdminShell/`、`pages/base/system/WorkflowsPage/WorkflowDesigner/` | 殼的 orgName/logoUrl 是組織識別槽,不做全檔 CookHome 文字替換           |

沿用現有 Brand → Color 的概念與語意名稱。專案品牌 Library 的輸出由程式生成,不另有一份人工色值正本。品牌陰影的幾何與透明度同樣讀程式。若生成包含中性色,其值仍來自底座固定 token,不變成專案可任意改的第二份設定。

對照必須同時包含語意名、類型、來源 Library/file、來源 variable/style key 與專案 key。node ID 只負責檔內定位;同名的不同集合、相同 HEX、重建後的新 key 都不能自動當成同一資產。多層 alias 須查到實際來源。搬檔前後另列身分遷移對照;日常更新則要求既有元件來源 key 保持,兩者分開驗。

### 同步範圍與客製保留

一次同步包含「接受底座 Library 更新 → 補套專案品牌 → 驗證來源與覆寫 → 記錄結果」。新增實例、切換變體也適用,單次 Swap library 不是永久全檔主題規則。

補套只處理對照表已辨認的受管品牌變數及品牌陰影;不掃 HEX 換色、不 detach、不重設整個實例。文字、logo/image、visible、instance swap、刻意自訂色與專案自有變數都要保留。幾何覆寫若阻擋底座更新,列出差異交由專案判斷,不默默清掉。

工具先輸出將修改、保留、缺漏與無法判定的項目。遇到缺 token、重名、類型錯誤、來源 key 漂移或無法辨認的覆寫,不得把它計為同步成功。必須在指定檔案與實例範圍內操作;A 的補套不能改 B 或底座。執行中斷後重新盤點再續作,成功記錄只在驗證完成後寫入。

### Git 與 Library 的版本對照

`package.json.wowgoBase` 繼續只記應用採用的正式 tag/commit。現行資產身分留在 `docs/branding.md`,可導航節點留在 FIGMA-09;發布與接受更新的證據留 issue/PR/Release,不另建人工發布帳本。

每次有 Figma 變更的底座發布,在 Library 發布描述與 Git Release 互相指向,記 tag、完整 commit、Library/file、可核對的 Figma 發布/版本連結及變更資產。若版本沒有設計變更,Release 明示沿用哪次已驗的 Library 發布。專案升級回報另外記錄接受更新的資產與頁面範圍、品牌來源 commit、補套結果、未解決差異。部分接受不能宣稱整個檔案已同步。

component key 是來源身分,不是版本鎖。發現指定發布後又有變更時須重新核對實際內容,不能僅因名稱含某個 tag 就宣稱鎖定該版。取得可機器核對的發布識別、部分接受與跨多次發布的行為,由 E2 先實測再固定 E3 的欄位和接縫;目前不承諾可依 Git tag 接受或回退任意歷史 Library。

### 隔離驗收矩陣

所有既有共用元件 family、變體與參考畫面先做綁定及身分基線盤點;所有畫面驗品牌殘留與連結。下表的更新情境用能涵蓋不同結構的代表元件,明列覆蓋清單,不只重跑三顆按鈕。兩個隔離品牌皆須通過,不將既有 POC 結果直接外推為全元件已驗。

| 編號           | 現況 / 操作                                                     | 期望                                                               |
| -------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| E01 基線       | 正式來源尚在同一檔;記 component/variable/style keys、綁定與覆寫 | 所有 family 有對照或明確排除理由;無未知來源被略過                  |
| E02 品牌       | 套兩種品牌到所有受管元件,包含六色及 Shadow/Primary              | 與程式生成相同;中性與 error/success 語意及陰影保留                 |
| E03 既有更新   | 底座改 padding/radius/結構,接受後補套                           | 更新生效,文字、圖片、組織識別、visible、swap 保留;幾何覆寫差異明列 |
| E04 新增與變體 | 更新後新增實例,切換狀態/大小/顏色/圖示                          | 受管品牌補套正確,未斷來源,錯誤狀態仍使用 error                     |
| E05 巢狀與隱藏 | 卡片、Dialog、殼的巢狀實例與隱藏備用槽                          | 隱藏後代也檢查,再次顯示無漏套;不碰範圍外元件                       |
| E06 新 token   | 新增元件真正使用的品牌 token,先缺對照再補齊                     | 缺漏時明確失敗;補齊後來自既有推導,不手填臨時色值                   |
| E07 身分變動   | token 改名/同名重建、刪除重建元件內圖層                         | 不按名稱誤配;重建造成的覆寫遺失可辨識並處理                        |
| E08 自訂覆寫   | 受管品牌、專案變數、手動自訂色/圖片同時存在                     | 只改確定受管項;保留客製,無法辨認的部分列待處理                     |
| E09 重跑與恢復 | 同狀態重跑,另測過期對照與中斷後重試                             | 第二次零修改;不污染另一品牌/底座;失敗無成功標記                    |
| E10 發布識別   | 部分接受、全部接受、兩次連續發布後再升級                        | 可對照 Git 與實際接受內容;未接受或來源漂移時不冒稱同步             |
| E11 首次搬檔   | 在測試檔搬共用元件/巢狀來源,發布並接受                          | 前後身分有映射、原實例仍連到正確來源,覆寫保留;可重現搬回流程       |

代表元件至少包含 Button 的 Primary/Error/Success、Avatar/Badge/Tabs、IconButton/Menu 的圖示 swap、AdminSideNav 的組織商標與隱藏槽、Flow 的 Selected/Error、DataTable 與 Table、文字/圖片/色彩混合覆寫。原檔缺稿或仍是 Draft 的項目列差異,不因此擴大補畫。

Figma 官方的[搬移已發布元件](https://help.figma.com/hc/en-us/articles/4404848314647-Move-published-components)要求完成移動、發布及接受更新,搬回也要走搬移流程;一般 undo 或還原文件版本不能代替。巢狀及未發布元件需一併核對。此行為先在隔離檔驗,不得拿正式 CookHome 試搬。

[接受 Library 更新](https://help.figma.com/hc/en-us/articles/360039234193-Review-and-accept-library-updates)可分資產處理,且隱藏層無法靠更新面板做視覺比較,因此驗收另含完整結構檢查。品牌更換的原生操作見 [Swap libraries](https://help.figma.com/hc/en-us/articles/4404856784663-Swap-libraries);API/UI 哪些部分能自動執行由 E2 留實證。

### 交付順序

1. **E1 盤點及本規格**:文件票;原 CookHome 只讀,原檔盤點由 CookHome 的品牌註冊表維護。本節保留的是尚未完成的 E2–E4 要求。
2. **E2 隔離驗證與介面定案**:沿用 TEST 專案,完成上表及正式元件涵蓋清單。先證明發布識別、搬檔、陰影與覆寫辨認能力,再在本節固定 E3 的檔案/函式/輸入輸出、產物欄位及失敗行為;不能交給實作者另選格式。
3. **E3 補套工具與測試**:Claude 依 E2 已固定介面實作,沿用現有品牌函式、測試工具與 `scripts/` 慣例。修正 Palette Lab 舊註解的品牌入口指路,不新增專案 `brands/<name>.ts` 正本。E2 未定案前保持未 Ready。
4. **E4 正式拆分及首次接軌**:E2/E3 完成後,提供精確來源/目的/影響實例/搬回方案,依正式操作的授權範圍執行。更新品牌註冊表、FIGMA-09 與操作正本;完成 E 後移除本節已交付計畫。F 再做跨 repo 的完整升級與回收演練。

## F:正式版本升級、回收與整體演練

已確認的目標:

- 向下同步以正式版本為單位,不跟每次 main commit。優先讓專案持續升級,舊版修補只作例外,不預設長期多版本支援線。
- 底座發布後,agent 為引用專案準備升級分支及 PR,分析影響、整合相容性並測試;不確定行為列待決,使用者審查合併及發布。
- 引用專案 PR 主動辨識底座改動與共用價值,提出回收建議,由使用者決定整理與納入;不自動接受回收。
- 升級保留專案品牌、設定、客製頁、帳號、組織與業務資料;資料轉換走明確 migration,不能以 reset 取代。
- 底座治理頁原版持續更新,不得整個 `system/` 排除升級;客製版須檢查 API、權限及互動相容性。依賴宣告整合後更新 lockfile,不整份選上游或本地。
- 升級報告列出新增能力及 wildcard 影響,區分種子模板、既有租戶副本與個別權限角色;Figma 接受更新及品牌補套納入同一次驗收。

正式 tag/Release、採用版本記錄與共同祖先操作見初始化及 deployment 正本。仍待設計回收分支起點、引用專案清單、觸發器、憑證權限、失敗回報與重試,並完成向下升級與回收的工具。

前置是 E;初始化與手動接軌/升級操作見上列正本。整體演練需以不同品牌、新增業務模組及替換治理頁的引用專案,升級共用 UI、API、seed 與 Figma;再回收一項通用修正,發布並再次向下升級。驗收須能從 repo 與操作文件重現,不能只以計畫或 skill 檔存在判定完成。
