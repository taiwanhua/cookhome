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

本節是 E 未完成工作的共用規格。原檔現況與可導航節點見 [CookHome 品牌註冊表](https://github.com/taiwanhua/cookhome/blob/main/docs/branding.md#figma-現況盤點);隔離測試的覆蓋與限制見本 repo 的[品牌註冊表](../branding.md#隔離品牌相容性測試)。共用元件、參考畫面的品牌補套及元件搬出/搬回已有實證;正式拆檔與通用工具仍未完成。

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

### E3 工具契約

以下是尚未實作的工具目標契約,不可作為目前可用工具的操作說明。隔離驗收結果見品牌註冊表,逐次發布、身分映射及驗證證據留執行 issue。

#### 現有接縫與維護歸屬

品牌人工輸入仍只有 `packages/project-config/src/project/public.ts` 的 `projectPublic.brand`。CLI import `@repo/project-config/public` 及 `@repo/ui/theme` 的 `createBrandFromPrimary`、`createCustomShadows`，不解析 TS 原碼、不另填六色、不讓 UI 反向依賴 project-config。Figma `contrast` 對應程式 `contrastText`，其餘五角色同名；primary shadow 的色、alpha、幾何都取 `createCustomShadows(primary.main).primary`。CSS 轉換只接受目前支援的單一 shadow 語法，未知語法拒絕，不以硬編碼數值備援；不能把 alpha=1 的主色綁定當成保留陰影 alpha。

成功累積 receipt 是由掃描、身分審查與驗證生成的機器狀態,記錄工具持有的屬性;不是第二份人工品牌設定。資產登記仍在 `docs/branding.md`,發布摘要仍在 issue/PR/Release。新 clone 從版控 receipt 接續,不依賴個人的 `.codex`。

#### 固定檔案與函式

以下檔案均位於 `scripts/figma-sync/`。入口與內部 factories 一起列入實作白名單，公開的六命令及 JSON 協定不因拆檔改變。

| 檔案                     | 固定接縫                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brand.mjs`              | `createFigmaBrandProjection(projectPublic)` → 六色、Brand→Color aliases、primary effect；無 Figma I/O。                                                                                       |
| `core.mjs`               | `createSyncCore(parts)` 組裝並提供 `validateArtifact`、`createIdentityReview`、`planSync`、`verifySync`、`reconcileInterruptedPlan`；無 Node/Figma import。                                   |
| `core-contract.mjs`      | `createArtifactContract()` → `validateArtifact(value)`、`createIdentityReview(input)`；同一 JSON 協定與精確身分選擇。                                                                         |
| `core-plan-consumer.mjs` | `createConsumerPlanner(contract)` → `planConsumer(input)`；受管/釋出 slots、來源漂移、resolutions 及場景 actions。                                                                            |
| `core-plan-brand.mjs`    | `createBrandPlanner(contract)` → `planBrand(input)`；品牌庫相依 actions 與既有 managedAssets。                                                                                                |
| `core-verification.mjs`  | `createSyncVerifier(contract)` → `verifySync(input)`；品牌/來源/保護欄位精驗與累積 receipt。                                                                                                  |
| `core-recovery.mjs`      | `createRecoveryCore(contract)` → `reconcileInterruptedPlan(input)`；before/after/第三值與 create 身分遺失。                                                                                   |
| `runtime.mjs`            | `createFigmaRuntime(figma,core,parts)` 組裝 `scanScope(request)`、`applyPlan(request,plan)`。Plugin API 僅在 runtime 系列檔使用。                                                             |
| `runtime-assets.mjs`     | `createAssetRuntime(figma,core)`；變數/alias/mode/style/publication owner 讀取及 exact import，無場景寫入。                                                                                   |
| `runtime-source.mjs`     | `createSourceRuntime(figma,core)`；source correspondence、祖先 context 與結構 guards。                                                                                                        |
| `runtime-scan.mjs`       | `createScopeScanner(figma,core,assets,source)` → `scanScope(request)`；完整 scope inventory。                                                                                                 |
| `runtime-apply.mjs`      | `createPlanExecutor(figma,core,assets,scanScope)` → `applyPlan(request,plan)`；先驗、逐筆執行及回讀。                                                                                         |
| `artifacts.mjs`          | `readArtifact(path)`、`writeArtifact({runDir,name,artifact})`、`hashArtifact(artifact)`、`writeVerifiedReceipt({rootDir,receipt,expectedPreviousDigest})`；Node SHA-256、路徑驗證、原子寫入。 |
| `prepare.mjs`            | import-safe `main(argv,io)` 與 direct-entry guard；re-export `buildExecutionSource`，不在 import 時執行 CLI。                                                                                 |
| `prepare-arguments.mjs`  | `parseArguments(argv)`；六命令與各自參數白名單。                                                                                                                                              |
| `prepare-commands.mjs`   | `runCommand(command,context,io)`；既有品牌/專案來源讀取與 artifact 生命週期。                                                                                                                 |
| `execution-source.mjs`   | `buildExecutionSource({request,plan})`；固定 factory 清單、受驗 JSON 與依賴組裝。                                                                                                             |

`core.parts={contract,consumerPlanner,brandPlanner,verifier,recovery}`，值均為上述 factory 的回傳物件；`planSync` 依 targetKind 分派兩個 planner。`runtime.parts={scanScope,applyPlan}`，分別注入 scanner 與 executor 回傳的方法。依賴建立順序為 contract → planners/verifier/recovery → core → assets/source → scanner → executor → runtime；core/runtime 不隱藏取得 module closure。

各 factory 必須能獨立序列化，依賴只由參數或函式內部取得。generator 序列化**同一份受測函式**並按上述順序組裝、加入已驗 JSON，不另存字串版實作、不以正則改 A/B probe、不 eval 使用者資料。執行仍用現有 Figma 工具；CLI 不讀 token、不使用私有 API。依已固定接縫控制檔案責任；已知仍超過 400 行時依 issue tracker 先補定拆檔，不自行改協定。root mjs 不受現有 frontend max-lines lint 直接覆蓋，不以 Turbo lint 成功冒稱已驗 root scripts。

E3 白名單另含：上述檔案對應的 `*.test.mjs` 與 `test-support.mjs`、根 `package.json`/`pnpm-lock.yaml`、`.github/workflows/ci.yml`、`.gitignore`、`.prettierignore`、`deploy/project/figma/receipts/*.json`、`apps/storybook/stories/palette-lab.stories.tsx` 的舊品牌入口註解。根 devDependencies 加 `@repo/ui`、`@repo/project-config` 的 `workspace:*`，先 build 兩套件再跑 generator；不得借 Storybook 依賴或私有 dist 路徑。CLI 直接沿用 `scripts/project-settings/single-line.mjs`，不複製 sanitizer。正式操作文件的必要同步由主流程列入文件票或明示例外，不讓實作者無界修改 CLAUDE。

#### 同一生成協定

request/inventory/identity-review/plan/attempt/receipt 使用一個 versioned JSON 協定。identity-review 是本次審查選擇的生成紀錄；receipt 是生成的持久狀態，兩者皆不接受另填 RGB。

```text
schemaVersion: 1
kind: request | inventory | identity-review | plan | attempt | receipt
runId: 唯一字串；scan 由呼叫者供應，review/plan/plan-brand 由工具生成，apply/record 沿用輸入
generatedAt: ISO UTC
project: { slug, repository, gitCommit, dirty, brandInputDigest }
tool: { gitCommit, sourceDigest }
```

SHA 均完整，JSON digest 使用 canonical JSON + SHA-256：object keys 遞迴依 UTF-16 code unit 順序排序、array 保留順序，以 JSON 字串表示再編成 UTF-8；拒絕 undefined、非有限數值等非 JSON 值，不省略任意欄位。人類文字排序沿 STRUCT-10 的 zh-Hant，canonical 排序不依 locale。dirty 只能如實記錄，不拿 commit 冒稱完整輸入。schema 拒絕未知 kind、缺必要欄位、錯誤型別與來源不符。生成 JavaScript 是傳輸產物，另以完整 UTF-8 bytes 計 SHA-256，不套 JSON canonicalization，也不新增 JSON artifact kind。

##### Request / Inventory

```text
request:
  operation: scan | apply
  targetKind: base-library | brand-library | consumer
  target: {fileKey, rootNodeIds[]}
  includeHidden: true
  brandProjection: {name,primary{lighter,light,main,dark,darker,contrast},aliases[],primaryEffect}
  inputDigests: {inventories[],identityReview:null|string,previousReceipt:null|string,plan:null|string}
  publicationEvidence: null | {baseGitTag,baseGitCommit,sourceFileKey,label,versionId,versionUrl,observedAt,changedAssetKeys[]}
  acceptanceEvidence: null | {sourceFileKey,consumerFileKey,observedAt,acceptedAssetKeys[],pageIds[],rootNodeIds[],scope:partial|listed-scope,evidenceUrl}

inventory:
  observedFileKey
  scope: {fileKey,rootNodeIds[],pageIds[],includeHidden:true}
  capabilities: {fileKeyReadable,variablesReadable,effectStyleReadable,sourceTreeReadable}
  coverage: {nodes,instances,remoteInstances,hiddenNodes,brokenInstances,unsupportedNodes}
  assets[]: {kind,fileKey,key,localId,name,resolvedType,collectionKey:null|string,modes,valueOrEffects}
  publicationOwners[]: {componentKey,componentNodeId,rawStatus,ownerKind,ownerKey,ownerNodeId,ownerRawStatus}
  slots[]: {locator,value,resolvedValue,aliasChain[],sourceMatch,observedOverrides[],protectedSnapshot}
  issues[]: {code,locator?,assetKey?,detail}
```

v1 **要求 `figma.fileKey` 可讀且 exact match** request.target.fileKey；缺少或不符，在任何 mutation/import 前失敗，不設 external context、檔名或 request echo 備援。roots 明確指定、去重，場景只寫 roots 及所有後代；Library metadata 可全檔唯讀列舉。hidden 不因目前不可見而略過。

`locator={fileKey,rootInstanceId:null|string,nodeId,field,index}`；field 僅 `fill-color|stroke-color|effect-style`，對應 `fills[i].color`、`strokes[i].color`、`effectStyleId`，effect-style 的 index=null。value 區分固定色/variable key/style key/mixed/missing，本地 ID 只定位，不是跨檔身分。aliasChain 每一步保存 `{variableKey,collectionKey,modeId,resolvedType,aliasTargetKey|null}`，按實際 consumer mode 解析；cycle、缺值、缺 mode、深度超限明確失敗。去重不能丟 mode/consumer 差異。

variant 若直接父層是 COMPONENT_SET，以該 set 為 publication owner；否則是 component 本身。保留 child 真 key/rawStatus 與 owner key/rawStatus；variant `UNPUBLISHED`、set `CURRENT` 不可改寫為同一狀態，也不能用 set key 替代 variant key。

publicationEvidence 是原生 UI 版本連結的觀測，不是 consumer 版本鎖。versionId 是 opaque string，不按數字大小排序。接受更新只能聲明實際接受的資產與範圍；無 publish/accept Plugin API 的承諾。

##### 身分審查入口

固定流程：生成 inventories → 審查 exact 資產 → CLI 生成 identity-review → plan。禁止按名稱自動接受；名稱只作畫面提示。CLI 的 selections 明示兩側的 file/key/type/role，每項必須在指定 inventory 中 exact 存在，且 source/project 語意與型別相容；不接受工具在 selections 之外自動補 key。

```text
identity-review:
  inventoryDigests: {base,brand,consumer:null|string}
  reviewEvidenceURL
  resolutions[]: {locator,consumerInventoryDigest,before,sourceMatchDigest,decision:adopt-source|preserve-project,expectedRole:null|string}
  selections[]: {
    role: lighter|light|main|dark|darker|contrast|primary-shadow,
    assetKind: variable|effect-style,
    source: {fileKey,key,resolvedType},
    project: {fileKey,key,resolvedType}
  }
```

同一色階可有 Brand 與 Color 各一個來源 key；每個 source exact key 只能有一個選擇，project alias terminal/role 必須一致，不因多層 alias 而自動認養未選的新 key。新 key、同名重建、型別或 alias 漂移需要新 scan 與新的 identity-review。既有 review 的 inventoryDigest 不符時拒絕；成功 receipt 內保存已驗 selections、alias 鏈與審查證據，下一次不要求人工重抄。

reviewEvidenceURL 指既有 issue/PR 的審查紀錄，不是工具憑此 URL 判斷來源正確；真正限制是精確 selections + inventory 核對 + apply 時重新檢查。CLI 只把明示選擇轉成同協定，不要求手編第三份品牌檔。

角色漂移、重建或已受管值被人工改動時,review 另明示 `resolutions`。每個決定綁定本次 consumer inventory、實際 before 與來源對照 digest;採來源要指定已審語意,保留專案則將該 slot 明確釋出受管範圍並記 `releasedSlots`。缺決定、決定過期或未能確認來源仍阻擋;這不是靠名稱解除衝突。

##### Plan / Attempt / Receipt

```text
planSync({request,inventories,identityReview,previousReceipt,resumePlan}) → plan:
  status: ready|blocked|noop
  targetKind, scope
  inputDigests
  identityMap[]: {role,assetKind,source,project,aliasChain,reviewEvidenceURL}
  actions[]: {actionId,locator,operation,params,role,sourceEvidence,before,expectedAfter,preconditions}
  preserved[]: {locator,reason,snapshotDigest}
  conflicts[]: {code,locator?,observed,expected,resolutionRequired}
  managedSlots[], managedAssets[]
  verification: {target:brand-bindings|library-upgrade,expectedRoleValues,expectedPrimaryEffect,protectedBefore,outsideScopeControls}

attempt:
  observedFileKey:null|string
  planDigest, status: interrupted|failed|applied
  completedActions[]: {actionId,result,readBack}
  errors[], afterInventory:null|inventory, afterInventoryDigest:null|string

receipt:
  status: verified
  verifiedFor: brand-bindings|library-upgrade
  targetFileKey, lastRunScope, planDigest, beforeDigest, afterDigest
  previousReceiptDigest:null|string
  publicationEvidence, acceptanceEvidence, identityMap[], identityReviewDigest
  brand: {inputDigest,projectionDigest,sourceGitCommit}
  releasedSlots[]: {locator,previousReceiptDigest,resolutionEvidenceURL,reason,reviewedValue,sourceMatchDigest,releasedRunId}
  managedSlots[]: {
    locator,role,
    source{fileKey,componentKey,nodeContextFileKey,sourceNodeId,ancestryPath,field,index,bindingKey,aliasChain},
    lastWrittenValue,verifiedValue,sourceMatchStatus,firstManagedRunId,lastVerifiedRunId
  }
  managedAssets[]: {fileKey,kind,key,localId,role,collectionRole:null|Brand|Color,collectionKey,lastWrittenValue,verifiedValue,firstManagedRunId,lastVerifiedRunId}
  changes: {planned,applied,recoveredAlreadyApplied,createdAssets,importedAssets}
  verification: {exactColors,exactPrimaryEffects,remainingBaseBrandSlots,sourceKeysPreserved,brokenInstances,protectedChanges,outsideScopeChanges,unresolved,unsupported,coverage,sourceSemanticCoverage,errors[]}
```

場景 actions 僅 `set-paint-variable|set-effect-style`；品牌庫另可 `create-collection|create-variable|set-variable-value|create-effect-style|set-effect-style-effects`。品牌庫 locator 為 `{fileKey,assetKind,key:null|string,localId:null|string,collectionRole:null|Brand|Color,role}`；collection 的 role=null，variable 為六色角色，effect-style 為 primary-shadow。collectionRole 區分 Brand/main 與 Color/main；effect-style 為 null。create.before=null，讀回真 key/localId 才記帳。空庫生成 Brand、Color 兩個僅有 Light 的集合、六 Brand 值/六 Color aliases、一個 Shadow/Primary style；同名未登記資產阻擋，不自動認養。發布仍走 UI，consumer 規劃前重掃 published keys。

`params` 依 operation 固定，不另填品牌檔；其中 RGBA/effects 僅由 brandProjection 產生：

```text
assetRef:
  {kind:collection|variable|effect-style,key:string}
  或 {kind:collection|variable|effect-style,actionId:string}
  // key 與 actionId 互斥；actionId 僅指本 plan 前序的同 kind create action

create-collection:
  {collectionRole:Brand|Color,name:Brand|Color,modeName:Light}
create-variable:
  {collectionRef,collectionRole:Brand|Color,name:"primary/<role>",resolvedType:COLOR}
set-variable-value:
  {variableRef,collectionRef,modeName:Light,value:{kind:rgba,rgba:{r,g,b,a}}|{kind:alias,targetRef}}
create-effect-style:
  {name:"Shadow/Primary"}
set-effect-style-effects:
  {styleRef,effects[]}
set-paint-variable:
  {variableRef}
set-effect-style:
  {styleRef}
```

collectionRef/variableRef/styleRef/targetRef 均使用 assetRef，種類須相符；alias targetRef 只能指 COLOR variable。場景兩個 set 操作只接受已發布的 existing key；品牌庫可使用前序 create reference。create-collection 的 name 必須等於 collectionRole；modeName=Light 對應該集合的實際 mode ID，不跨集合沿用 ID。create readBack 保存 `{kind,key,localId,defaultModeId:null|string}`，集合必須回實際 defaultModeId 且其名稱為 Light。variable name 及 action.role 必須一致，Brand 值用 rgba、Color 值用指向對應 Brand role 的 alias。

apply 在任何 mutation 前驗整張相依圖，拒絕 forward reference、cycle、kind/role/collection 不符。執行時僅用前序成功 readBack 解析 created refs；原 plan 的 params/expectedAfter 保持不可變，不預填不存在的 key。expectedAfter 描述預期內容與這些 references，回讀比對時以同一成功 readBack 解析；receipt 一律保存真身分。中斷恢復可用原 run 已封存 attempt 的 readBack；若 create 已發生卻未取得 key，仍回 CREATED_ASSET_IDENTITY_UNRESOLVED，不按名稱尋找或重建。

`scanScope(request)` 回傳 inventory；`applyPlan(request,plan)` 回傳 attempt，內嵌實際 afterInventory。runtime 的 afterInventoryDigest 為 null，record 驗證並封存 inventory-after 後計算，保存的 attempt 才帶該 digest。failed/interrupted 盡可能附可取得的 afterInventory；fileKey 不可讀時 observedFileKey=null，必須失敗且零 mutation。完全丟失回應時不捏造 attempt，沿原 plan + 新 scan 恢復。

`verifySync({plan,beforeInventory,afterInventory,previousReceipt,attempt})` 回傳 `{status:verified|failed,verification,receipt:null|receipt}`；只有完整驗證成功才有 receipt。record 使用 run 內固定的 plan/before/prior snapshots 及 runtime 真結果再呼叫同一 verifySync，不信任 runtime 自報成功。verification 失敗不得更新持久 receipt；已完成寫入仍如實保留於 attempt。

任何受管 conflict/unsupported 阻擋整個 apply。要只處理已確認範圍，另產 scope 更小的 plan，保留剩餘清單。noop 必須無未解項且仍通過驗證，零 actions 不代表整檔接受過更新。apply 前重掃核對 file/scope、key/type/alias、actions.before、來源關係及 protected fields；不符 `STALE_PLAN` 且零場景寫入。noop 不 import；只 import 實際寫入所需資產。

receipt **累積全部仍存在的受管 slots/assets**，不是本輪 delta。同檔小範圍成功只更新該範圍，scope 外項目原樣保留其 lastVerifiedRunId，不把它們假裝本輪已驗。slot 唯一鍵使用 fileKey+nodeId+field+index，rootInstanceId 是路徑證據，不因 scope 換 root 就另建重複 ownership。範圍內節點消失/重建須可追溯說明，未解不能直接刪登記後宣稱成功。頂層 lastRunScope 不代表整檔或所有歷史 scope 都已同步。

受管判定要求現值仍等於 receipt.lastWrittenValue、來源及 locator 可確認。相同 project key/HEX 或 `fills` override 不能單獨證明是工具擁有。只有 direct binding 補套已驗時 verifiedFor=brand-bindings；library-upgrade 另要求實際接受證據與來源語意覆蓋完整，required unresolved/unsupported 均為零。record 根據 plan 及真結果判定，不提供手填成功旗標。

#### Source correspondence：固定算法與已知限制

已知 `getMainComponentAsync()` 可取主元件；未承諾存在任意節點的 getSourceNode API，亦不依 instance ID 的分號格式猜來源。`overrides` 不是完整繼承覆寫清單。

主流程已實測兩品牌各 210 個 roots、各 **778 個 variable paint slots，零 fault**。instance root 對自己的 main component，沿**實際 child-index 路徑**逐層比 type/child count。遇 consumer/source 皆為 nested INSTANCE 時，先比較兩者 actual main keys：相同則保留祖先來源樹中的 **source instance context** 繼續比，不跳回孤立的 master；不同才視為使用者 swap，取 consumer 的 actual main 建立新來源範圍，記錄 swap 與前後祖先來源鏈。這保留來源元件本身施加的 inherited overrides，不把它們誤認為 project custom。

實測包含 AdminSideNav 內 NavItem 的來源 instance `primary/lighter` 覆寫（孤立 NavItem master 的 fills 是空陣列），以及 Dialog dot 的 path `[2,1,1]`；祖先 context 保留後可辨識 source `primary/emphasis`。全程未解析 instance ID 字串；覆蓋外資料仍 fail-closed。

```text
sourceMatch: {
  status: exact-root|validated-structure|unresolved,
  componentKey,nodeContextFileKey,sourceNodeId:null|string,
  ancestryPath:[{consumerParentId,sourceParentId,childIndex,consumerType,sourceType,consumerChildCount,sourceChildCount,nestedComponentKey:null|string}],
  paintShape:null|{consumerCount,sourceCount,consumerPaintTypes[],sourcePaintTypes[]},
  sourceSlot:null|{field,index,bindingKey,aliasChain},
  sourceInventoryDigest:null|string,consumerInventoryDigest:null|string,previousReceiptDigest:null|string,
  reason:null|string
}
```

raw inventory 的 sourceInventoryDigest、consumerInventoryDigest 均為 null；scan 只保存讀到的來源脈絡與 guards。record 封存 inventory 後不再修改其內容。review/plan 由封存輸入的 digest 建立證據，在所複製的 sourceMatch 填 consumerInventoryDigest；sourceInventoryDigest 只指實際提供並核對過的來源 Library inventory，沒有時保留 null，不以 consumer digest 冒充。inputDigests/inventoryDigests 保存這些引用，不把外層 inventory 的 hash 回填到它自己內部。resolutions.sourceMatchDigest 以封存 raw inventory 中該 slot 的 sourceMatch 計算，plan 加入引用後也用同一 raw 內容核對，避免 digest 補註改變審查對象。

receipt 保存完整祖先來源鏈，而非只留最後的 nearest main。sourceNodeId 是 **consumer 檔內 imported node ID**，其命名空間由 nodeContextFileKey 明記，不得冒充實際 Library 檔內節點 ID 或跨檔 stable ID。來源 Library file/key 另由已審查身分對照記錄，兩者不可混用。首次搬檔必須重新 scan/review；日常更新若 imported sourceNodeId 改變，可保守列 conflict，但不能僅因 name/path 相同自動認養新節點。

每層 type/count、祖先 source context、nested actual component key 與既有 path 都須核對。結構插入、刪除、重排或 nested swap 變更時重新盤點並明列來源範圍；同名或同形不等於相同身分。types/counts 是結構 guard，不是通用身分 API。

在上述祖先 context 正確的前提下，paint 仍只有 count 及逐項 type 一致才可按 index 對應；不符回 `PAINT_SHAPE_CONFLICT`，不能硬配。若另有確定為專案刻意自訂的項目，須有該 locator 的明示保留證據才能列 preserved，不靠畫面相似豁免；本輪 NavItem 已由祖先來源覆寫正確解釋，不再列此 conflict。

首次 slot 直接綁已審查的底座 key/alias，可確認當次品牌角色；尚無可靠 counterpart 時只允許如實驗 direct binding 的 brand-bindings，不承諾日後 Library 語意更新也自動可驗。已變成 prior 工具的專案 override、又無可靠 accepted source counterpart 時，`SOURCE_MATCH_UNSUPPORTED`。來源由 main 改 light，即使現值等於上次工具值，也列 `SOURCE_ROLE_DRIFT`；審查後以新 scan/review/plan 明確修復，不能自動沿用 main。E2 已見 A override 擋住新語意、B 跳過 R1 可接新 token，不能只檢查畫面色或 patch=0。

釋出紀錄同樣累積,scope 外紀錄不變。已在 releasedSlots 的 exact slot 即使仍綁已知底座 key,也不能自動重新收管;只有綁定新掃描、實際值與來源 guards 的 adopt-source resolution 才能收回。未解的節點重建或身分變動仍需審查,不能以刪除釋出紀錄繞過。

#### 驗證與恢復

未知來源/alias/key/type 不靜默略過。可證明是專案私有的變數/固定色保留，即使 HEX 同底座。mixed text、gradient、effect binding 等若影響受管項又未支援，回 `UNSUPPORTED_BINDING`，不轉固定色或重設整個 instance。

精驗：六色 resolved RGBA/aliases；primary shadow 完整 type、色、alpha、offset/radius/spread/visible/blendMode；底座品牌殘留；component key/連結；文字、image hash、私有色、visible、nested swap、geometry，以及 scope 外控制值。浮點容差固定規格 1e-6，不能只比較 HEX。protected 比 canonical values，hash 供摘要；無法讀的欄位列 coverage/unsupported，不宣稱所有覆寫完整保留。文字 paint 寫入前載入需要的字型，缺字型失敗，不代換。

apply 前保存 plan 的每筆 before/expectedAfter 與 guards。每筆寫前再驗、寫後讀回；失敗只記 attempt，無成功 receipt。取消或回應遺失後，以原 plan 重掃：等於 before→pending；等於 expectedAfter 且 guards 有效→already-applied；兩者皆非→conflict。不能只依已寫 count 跳 N 筆，不自動 rollback。恢復新 plan 記原 planDigest，scope 完整精驗後才寫成功狀態。

create 成功卻遺失新 key 回應時，不按名稱認養或再建一份，回 `CREATED_ASSET_IDENTITY_UNRESOLVED` 待盤點；已知 exact key 更新的恢復能力不能外推為所有 create 的 exactly-once。E2 的受控第一筆後停止→剩五筆→重跑零修改，不等於真網路丟回應實測；後者先用 fake executor 驗恢復分支。

#### CLI、保存位置與接手

plan 的 verification-target 必填;選 library-upgrade 時,兩份 evidence JSON 必填且結構沿 request 的既有欄位,必須涵蓋本次 file、資產及 scope,否則回 blocked。brand-bindings 可不提供發布/接受證據,但不得輸出 library-upgrade 成功。plan-brand 固定 brand-bindings。scan request 的兩份 evidence 可為 null;plan 將審查後證據組入 apply request,不要求手改生成檔。

```text
scan --kind <base-library|brand-library|consumer> --file-key <key> --roots <IDs逗號分隔> --run-id <id>
review --base <inventory.json> --brand <inventory.json> --selections-json <JSON陣列> --review-evidence-url <URL> [--consumer <inventory.json> --resolutions-json <JSON陣列>]
plan --base <inventory.json> --brand <inventory.json> --consumer <inventory.json> --identity-review <identity-review.json> --verification-target <brand-bindings|library-upgrade> [--publication-evidence-json <JSON物件> --acceptance-evidence-json <JSON物件>] [--resume <plan.json>]
plan-brand --brand <inventory.json> [--resume <plan.json>]
apply --plan <plan.json>
record --request <request.json> --result <runtime-result.json>
```

固定六命令。scan 產 request/scan.js；現有工具執行後 record 驗 observedFileKey 並存 inventory。review 以精確 selections 產 identity-review；plan 自動讀當前 repo 對應 targetFileKey 的成功 receipt。已有累積對照可直接由 receipt 生成本次 review 輸入，但缺新 key/角色選擇不得自動接受。plan-brand 用同協定從空/既有品牌庫生成，不接受第二份品牌 JSON。apply 產 request/execute.js；record 保存 attempt/after inventory，唯 verified 成功更新 receipt。Runtime 不讀本機檔，所需 prior 狀態嵌入受驗 plan。

record 的 `--result` 只接受協定 JSON 本身：scan 對應 inventory、apply 對應 attempt。執行入口將 runtime 回傳的 JSON 值保存，不傳 MCP content envelope、不從任意深層或混合文字猜 JSON。record 核對 kind、request/run/project/target、observedFileKey 及 plan digest；applied attempt 缺完整 afterInventory 一律失敗。fileKey 不可讀的 failed attempt 可封存，但不作成功證據。

CLI 成功 stdout 一行 `{runId,status,artifacts:[{kind,path,digest}],counts}`、stderr 空、exit0；blocked plan 是有效分析輸出，apply 不可用。JSON 輸出的 artifacts.kind 沿六種協定 kind，生成 JS 則固定為 `execution-source`，digest 取完整 bytes。參數/型別/來源/I/O 錯誤 stdout 空、stderr 一行、exit1。record 遇執行或驗證失敗先存 attempt，再 exit1，保留前次成功 receipt。沿 `singleLine`，不回印未知 argv 或整段例外。禁止未知/重複旗標，selections 為單一 JSON 陣列參數。

暫存：`.artifacts/figma-sync/<runId>/`，`.gitignore` 與 `.prettierignore` 都加精確 `.artifacts/figma-sync/`。固定檔名 `request-<kind>-scan.json`、`scan-<kind>.js`、`inventory-<kind>.json`、`identity-review.json`、`plan.json`、`request-apply.json`、`execute.js`、`attempt.json`、`inventory-after.json`。輸入 snapshots 放同 run 的 `inputs/`，依上述固定 artifact 名加 `previous-receipt.json`、`resume-plan.json`、`resume-attempt.json` 保存；缺少的 optional input 不建立。輸入 digest 以原 artifact 內容計算，不為同 run 保存而改寫其 runId/generatedAt。kind 在檔名只允許三個 targetKind 枚舉，不接任意路徑。committed receipts 正常參與 JSON 格式檢查，不排除其目錄；空白排版不影響 canonical digest。

scan 的 `--run-id` 由呼叫者提供，必須是尚未使用的單一路徑片段；拒絕 slash、dot segment、控制字元。review/plan/plan-brand 各自生成新的唯一 runId 並保存必要 inputs；apply 沿 plan.runId、record 沿 request.runId。允許在既有 run **首次新增固定檔名**，不覆蓋已存在的 artifact；恢復產生新 resume plan/run，保留原 attempt。

record 保存原始協定回傳為 `runtime-result.json`（內容 kind 仍是 inventory/attempt），使 raw runtime digest 與補上 afterInventoryDigest 的封存 attempt 可分別核對。同 request/run 的相同 canonical runtime-result 重送可冪等完成或回報原結果，不重做 Figma 寫入、不更改 generatedAt；不同內容回 `RESULT_CHANGED`。若 record 上次中斷，沿固定 inputs 及已寫檔繼續首次寫入；已存在 artifact 必須符合原輸入與生成內容，不能覆蓋。持久 receipt 若已等於本次預期結果則不再 CAS；若已變成其他後續結果，回 `RECEIPT_CHANGED`，不得以重送舊結果回退。

**正式生成狀態：`deploy/project/figma/receipts/<targetFileKey>.json`，應 commit。** consumer/brand-library 都按自己的 fileKey 分檔。檔案包含累積 managedSlots/managedAssets、身分對照、最新 scope 驗證及來源證據，未來新 clone 直接讀它。不是把所有 scene 文案/圖像 bytes 存進 repo；protected 完整資料留暫存，成功檔只需其摘要/digest 與補套必需的品牌 slot 狀態。

writeVerifiedReceipt 必須同時驗 expectedPreviousDigest 等於磁碟現值、repository/slug/targetFileKey 相同，並在同目錄暫存後原子 rename；前次已被更新則 `RECEIPT_CHANGED`，不覆蓋。無 previous 時檔案必須不存在。fileKey 驗為單一路徑片段，拒絕 slash、dot segment、控制字元。此寫檔不自動 commit；依原 PR 流程提交。合併衝突不能整份選 ours/theirs，須以當前 Figma 重掃、保留仍可證明的 ownership 後生成。

新專案不能使用隨底座複製而來、repository/slug 不符的 receipt；初始化只繼承工具，不認養其他 repo/file 的成功狀態。這項納入既有 project-bootstrap/初始化索引，不另造獨立初始化設定。底座更新也不得覆蓋引用專案的 project receipts。

issue/PR 沿既有交件格式附完整 Git SHA/tag、三側 file/scope、品牌來源、原生發布連結、實際接受資產與範圍、plan/receipt digest、planned/applied/remaining/conflict/unsupported 數、精確色/陰影/連結/覆寫結果，以及必要暫存 evidence 的可下載位置。失敗跨人接手須附 pending plan/inventory/attempt，不能只剩某人的 `.codex`；成功後接手的必要持久狀態則已在 repo。

#### 測試與 CI

- `brand.test.mjs`：真 public exports、多品牌 fixture、六色/對比/alias/shadow/alpha；不鎖正式專案名稱或顏色。
- `core.test.mjs` 及各 core helper 同名測試：review exact file/key/type/role/digest、同名異 key/同 HEX 私有色、alias cycle/缺 mode/深度超限、role drift、source rebuild、partial acceptance、累積/noop receipt、stale guards、unsupported matching、恢復 before/after/第三值。另驗 raw digest 無自我引用、封存 inventory 不改寫、品牌初建 refs 的順序/種類/集合檢查。
- `runtime.test.mjs` 及各 runtime helper 同名測試：fake Figma；fileKey 缺/不符零 mutation、hidden/scope 外保護、noop 零 import、paint 其他欄位保留、shadow、partial write/丟回應、create 身分遺失。空品牌庫初建兩集合/12 variables/aliases/一 style、再跑零 action；attempt 內嵌完整 afterInventory。mock 不能充當真發布/搬檔證據。
- `prepare.test.mjs`、`artifacts.test.mjs`、各 CLI/generator helper 同名測試與 `test-support.mjs`：native node:test + tmp/spawnSync，六命令完整串接而不手編 artifact、stdout/stderr、run 首次 append/拒絕覆蓋、record 同內容冪等/異內容拒絕、receipt CAS/路徑/跨 repo 拒絕、partial scope 保留、失敗不改前次 receipt、新 clone 只靠 committed receipt 續跑。生成 JS 必須在 fake Figma 真執行並與直接 factories 結果相等，不能只驗字串或語法解析；各依賴皆使用同一份受測函式。
- CI 獨立 `figma-sync` job：pnpm frozen install、build UI/project-config、`node --test scripts/figma-sync/*.test.mjs`，加入 `verify.needs`；root scripts 不依賴 Turbo affected 自動涵蓋。格式用現有 Prettier；離線 CI 不要 Figma token。
- 正式工具完成後，以它重跑 E2 必要隔離驗收；probe 通過不是 E3 程式測試通過。

#### 搬移證據與開工條件

一般 apply 不搬檔。E11 的 component 搬移結果不得外推到 variable 或 style;首次正式拆分若需搬其他資產,須各自驗身分與消費端連結。搬移證據沿既有 issue/PR 保存來源/目的/搬回檔、兩次發布連結、每個 asset 的 old/new file/key/nodeId、巢狀相依、實際接受範圍及覆寫前後差異。

來源對照原型在兩品牌的全量元件上各比對 778 個變數 paint slot,保留祖先元件的巢狀覆寫後未發現結構差異。此結果界定可支援的實測結構;相同 type/count/path 不能證明任意重建層的身分。來源或 ancestor context 無法確認時,工具仍應回 conflict。

### 交付順序

1. **E3 補套工具與測試**:Claude 依固定介面實作,沿用現有品牌函式、測試工具與 `scripts/` 慣例。修正 Palette Lab 舊註解的品牌入口指路,不新增專案 `brands/<name>.ts` 正本。以正式工具重跑上述適用的隔離驗收。
2. **E4 正式拆分及首次接軌**:工具驗收後,提供精確來源/目的/影響實例/搬回方案,依正式操作的授權範圍執行。更新品牌註冊表、FIGMA-09 與操作正本;完成 E 後移除本節已交付計畫。F 再做跨 repo 的完整升級與回收演練。

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
