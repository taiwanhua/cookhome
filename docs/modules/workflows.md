# 審核流程與申請中心(技術)

審核流程的 api 端:**流程設計**(`apps/api/src/workflows/workflow-design/`:流程、版本、四步發布、分派 / fork、表單綁定)、**引擎**(`workflow-engine/`:送出的寫入順序、`advance` 的執行器、決定 / 撤回 / 改派 / 新增審核者 / 重試推進、審核者失效 hook、讀取授權、通知信、阻擋清單)與**申請中心**(`apply-center/`:我的申請 / 待我審核 / 新申請 / 實例詳情 / 決定)。兩邊共用的判準在 `apps/api/src/workflows/` 根目錄。定義的形狀、檢查器、送出時檢查與 `advance` 判斷表是前後端共用的純邏輯,在 `@repo/domain/workflow`(`packages/domain/README.md`)。

規格正本是審核流程的 Spec(6b);本文件寫 api 怎麼落地、選了哪些做法與為什麼。

## 用途

- 一張表單可以**綁流程**:送出後依關卡找審核者、產生任務、核准 / 駁回 / 退回,核准才 `completed`。沒綁流程的表單維持送出即完成(6a)。
- 流程是**執行期資料**(畫面上設計、版本化、發布、共用 / 分派 / 客製),不寫進 seed;seed 只有兩個固定模組(申請中心 `apply-center`、流程管理 `system.workflows`)與表單模組範例「請假」。
- 引擎原則:**實例是唯一權威**(關卡進度、派任計畫、已接受的決定都在實例文件上,任務只是投影);每個寫入都是條件更新;每個中斷都有冪等的恢復入口。不用 Mongo 交易。

## 模組 key 與權限表

| 權限 key                                 | moduleId 指向 | 它是哪一頁的什麼                                                                                                         |
| ---------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `system.workflows.view`                  | 流程管理      | 流程清單、流程、版本、檢查器(`validateWorkflowVersion`)                                                                  |
| `system.workflows.create`                | 流程管理      | 建流程(根組織 = 共用、租戶內 = 客製)、以某版為基底建流程(fork)                                                           |
| `system.workflows.edit`                  | 流程管理      | 改名稱、開草稿、存草稿(只能動自己擁有的流程)                                                                             |
| `system.workflows.publish`               | 流程管理      | 發布、重試發布、退役目前版本                                                                                             |
| `system.workflows.assign`                | 流程管理      | 分派 / 收回共用流程(另外要站在根組織)                                                                                    |
| `system.workflows.blocked-page.reassign` | 阻擋清單      | 阻擋清單查詢、改派、新增審核者、重試推進(隱藏頁自有權限,不靠父模組 wildcard)                                             |
| `system.forms.edit`                      | 表單管理      | 表單的流程綁定 / 解除、流程下拉(`formWorkflowOptions`)——綁定掛在表單管理列表上                                           |
| `apply-center.view`                      | 申請中心      | 我的申請、待我審核、新申請入口                                                                                           |
| (無)                                     | —             | `workflowInstance` / `decideTask` / 撤回 / 作廢 / 複製:授權是「讀得到那個修訂」「我是承辦人」「我是申請人」,不看頁面權限 |

正本:`apps/db-migrator/seeds/modules/system.ts`、`apps/db-migrator/seeds/modules/apply-center.ts`、`apps/api/src/workflows/workflow-keys.ts`

## 資料

`workflows`、`workflow_versions`、`workflow_instances`、`workflow_tasks` 四張表(欄位與索引見 `docs/data-model.md` 與各 schema 檔),加上 `business_relationships` 的 `org_workflow`(分派)/ `org_form_workflow`(綁定)、`core_relationships` 的 `org_manager`(主管)、`form_submissions` 的 6b 欄位。

- `workflows` / `workflow_tasks` 以 `tenantId` 為邊界(`WorkflowsRepository` / `WorkflowTasksRepository`,沒給拋錯)。
- `workflow_instances` 是模組資料表(掛 `moduleData`),引擎一律以**系統上下文 + 明確的 `tenantId` / id 條件**讀寫(資料範圍規則對它不套);審核者的讀取走 `canReadSubmissionRevision`。
- 引擎對 `form_submissions` 的讀寫走 `database/workflow-submission-store.ts`(原生 collection、每個方法強制 `tenantId`):審核者與背景推進不在申請人組織的可見範圍內,而資料範圍規則可以對「全部操作者」生效,經 `FormSubmissionsRepository` 會把系統讀取也收窄。寫入只有引擎的條件同步(「提交仍指向本實例 + 修訂號相符 + 審核中」)。

## 可見、可改(設計端)

判準只有一份:`apps/api/src/workflows/workflow-access.service.ts`(操作者事實沿用表單的 `FormAccessService.factsOf`)。

| 操作者     | 看得到                                                    | 改得動         |
| ---------- | --------------------------------------------------------- | -------------- |
| 站在根組織 | 共用流程(客製流程只有該租戶看得到)                        | 共用流程       |
| 站在租戶內 | 自己的客製 + 分派來的共用流程(有 `org_workflow` 且已發布) | 自己的客製流程 |

- 租戶可以直接建客製流程(自動建本租戶的 `org_workflow`),也可以 fork 看得到的流程的已發布 / 已退役版本。
- 讀不到一律 `NOT_FOUND`;讀得到但不是自己的 → `FORBIDDEN`(`NOT_WORKFLOW_OWNER`)。分派 / 收回要站在根組織(`ROOT_ONLY`)。

## 版本與發布

與表單版本**共用同一份生命週期**:`apps/api/src/versioning/version-lifecycle.ts`(`interruptedPublishOf` / `assertNotPublishing` / `lockDraftForPublish` / `switchToPublished` / `retireCurrentVersion`)。表單的 `FormPublishService` 與流程的 `WorkflowPublishService` 都只提供自己的設定(版本表、切換擁有者 `currentVersion` 的條件更新、`CONFLICT` 錯誤、檢查點)。流程少了欄位級權限那一步:檢查器 → 搶鎖配版號 → 三筆切換;中斷(`publishInterrupted`)時 `retryPublishWorkflowVersion` 從切換那步冪等重跑,期間開草稿 / 退役 / 再發布一律 `CONFLICT`(`PUBLISH_IN_PROGRESS`)。檢查點 `WorkflowPublishHooks`(測試在那裡注入失敗)。

- **定義**以 `definition: { steps, edges? }` 進出:`steps` 是 `StepDef` 的 JSON(含 `kind: review | join`),`edges` 缺席 / `null` / 空陣列都存 `null`(= 直線)。`workflow-definition-input.ts` 只做型別整形、不判對錯(保留會被檢查器指出的東西),草稿讀寫、fork、發布快照、版本讀取原樣保留節點 `kind` 與連線。
- **檢查器**(`workflow-definition-checker.ts`)組好 `validateWorkflowDefinition` 要的目錄:共用 / 客製、本租戶的角色與使用者、`field` 來源表單與「檢查用表單」的**目前版本**欄位(共用流程只認共用表單;客製流程認共用表單與自己租戶的客製表單)。存草稿照收(錯誤隨 `validation` 回),發布有錯 → `VALIDATION_FAILED` + `issues`。共用流程含 `users` → `USERS_IN_SHARED`;客製流程的 `role` 沒填 / 不是本租戶的角色 → `ROLE_ID_MISSING` / `ROLE_NOT_IN_TENANT`。
- **退役目前版本 / 改版 / 收回分派**:進行中的實例照常走完(實例記自己的 `(workflowKey, workflowVersion)`),只影響新送出。

## 流程綁定

`workflow-design/workflow-bindings.service.ts`。`org_form_workflow`(`tenantId` = `firstId` = 租戶頂層、`secondId` = 表單、`thirdId` = 流程);唯一鍵 `(tenantId, type, firstId, secondId)` = 一張表單最多一個流程,多張表單可綁同一個流程。綁定是 upsert(換流程 = 改 `thirdId`),解除 = 刪這筆。要站在租戶內(`TENANT_ONLY`)。

**綁定時檢查**(設計輔助,不取代送出時檢查;不過 → `VALIDATION_FAILED` + `issues[{ stepKey, stepNumber, problem, detail }]`):

| 流程的關卡來源 | 共用流程                                                                                                                 | 客製流程                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `manager`      | 可                                                                                                                       | 可                                            |
| `field`        | 屬於被綁的表單、欄位在它的目前版本且是使用者引用欄(`FIELD_FORM_MISMATCH` / `FIELD_MISSING` / `FIELD_NOT_USER_REFERENCE`) | 同左                                          |
| `role`         | 不可(`ROLE_IN_SHARED`,建客製流程)                                                                                        | `roleId` 要是本租戶角色(`ROLE_NOT_IN_TENANT`) |
| `users`        | 不可(`USERS_IN_SHARED`)                                                                                                  | 人要在本租戶(`USER_NOT_IN_TENANT`)            |

另外流程要本租戶看得到且**已發布**(沒有發布版 → `FORBIDDEN` `WORKFLOW_UNPUBLISHED`,不給綁)。`FormModel.workflowBinding` 回綁到哪個流程與 `isValid`(流程已收回分派 / 讀不到 / 沒有發布版 = 失效,送出一律擋);`formWorkflowOptions(formKey)` 列可選流程與各自的檢查結果。

## 送出(綁流程時)的寫入順序

`workflow-engine/workflow-submit.service.ts`,掛在 6a 的 `submitFormSubmission`(`form-submissions.service.ts`)裡:

0. 提交已是 `reviewing` 且指向屬於目前修訂的實例 → **直接接續**(`linking` 補第 4 步、之後推進);不跑送出時檢查、不看目前綁定、不增加修訂。
1. 6a 的驗證與重算 → **送出時檢查**(`@repo/domain/workflow` 的 `checkSubmitCompatibility`):沒綁也沒進過審核 → 6a 行為;擋下 → `FORBIDDEN` + reason(`WORKFLOW_REMOVED` / `WORKFLOW_UNPUBLISHED` / `WORKFLOW_MISCONFIGURED` + `issues`)。綁定指向被收回或不存在的流程,不論有沒有進過審核一律擋。新修訂號 N = 目前 + 1。
2. 建 `linking` 實例(`(submissionId, N)` 唯一;每個節點一筆 `pending` 的 StepState;記 `linkSource`)。撞唯一鍵:`linkSource` 相同沿用、不同整份重置(未連上、沒有任務,重置安全)。
3. 提交的 `values` / `summary` / `revision` / 快照 / `reviewing` / `currentInstanceId` / `editVersion` **同一次**條件更新;前一個修訂被退回 / 撤回的實例 → `superseded`(推進收尾它自己的任務與歷程,不碰提交)。
4. 實例 `linking → running`、`activeStepKeys = [startStepKey]`、`history: started`(CAS)。
5. `advance`。

任一步失敗,重送同一次送出會從缺的那步接下去;`linking` 的實例不派單。三個檢查點(`submit:instance-created` / `submit:submission-linked` / `submit:started`)在 `WorkflowEngineHooks`,測試在那裡注入中斷。

## 推進(`advance` 的執行器)

`workflow-engine/workflow-engine.service.ts`。判斷表本體與**執行合約**在 `@repo/domain/workflow` 的 `advance.ts` 檔頭,這裡只執行:

1. 讀實例(權威)、它的全部任務、對應的提交 → `advance`;列 5 需要時先解析進關結果(`step-entry.service.ts`:跳過條件用**該修訂**的值與送出當時的 `ctx`;審核者四種來源只算啟用中且仍在本租戶的人;`manager` 用 `OrgManagersService.resolveManagers`)再呼叫一次(兩段式)。
2. 依序執行動作。實例的條件翻成 Mongo(`instance-writes.ts`):`editVersion` CAS、狀態、`outcome` / `finishedAt` 為 null、節點狀態以 `$elemMatch` 對陣列元素下條件、`activeStepKeys` 的 `$nin`;節點欄位以 `arrayFilters` 指到 `stepKey`(`BaseRepository.findOneAndUpdate` 的 `options.arrayFilters`)。任務用 `(instanceId, taskKey)` 唯一鍵與讀到的狀態;提交用同步資格條件;`appendHistoryOnce` 以 `history` 沒有同種類 + 同 `taskKey` / `result` 的事件為條件。
3. **`updateInstance` 的條件不成立就中止本輪**、重讀再判斷;其他動作條件不成立 = 已做過。`invalidState` 不寫、停下、記 log(會一直出現在「需要推進」)。
4. 重複到沒事可做(上限 60 輪,超過記 log 停下,重試推進可接續)。已發布的流程版本不會變,定義快取在記憶體。

入口:送出、`decideTask`、撤回、改派、新增審核者、審核者失效 hook、`retryAdvanceInstance`(寫 `advance_retried`)。

## 決定、撤回、改派、新增審核者、審核者失效

- **`decideTask`**(`task-actions.service.ts`):前置(任務是我的且 `pending`、提交仍指向這個實例、實例進行中、關卡在 active 且為 active、退回要 `allowReturn`、駁回 / 退回理由必填、任務 `expectedEditVersion`)後,**單文件原子**寫實例:條件含「關卡仍 active、我仍是這一項的有效承辦人、這個 `taskKey` 還沒有決定」→ `$push steps.$[cur].decisions` + `$push history` + `$inc editVersion`;**不比對** `editVersion`(兩人同時決定都會被記下,誰算數由 `advance` 依接受順序判)。條件不成立、任務已不是 `pending`、我已被改派走 → 回 `result: stepClosed`、任務不動。
- **撤回**(申請人;`instance-withdraw.service.ts`):CAS `{ editVersion, 進行中, 所有關卡都沒有決定 }` → `withdrawn`、active 關卡 `terminated`;「沒有決定」寫在條件裡,所以撤回讀到無決定後決定才寫入 → CAS 失敗 → 重讀看到決定 → `CONFLICT`(`HAS_DECISIONS`)。推進收尾把提交同步成 `withdrawn`。
- **改派**:對 `pending` / `blocked` 任務指定新人(啟用、在本租戶、不是申請人;已在本關的計畫裡 → `ALREADY_IN_STEP`);CAS `{ editVersion, 該 taskKey 尚無決定 }` → 計畫該項換人、原人進 `previousAssigneeIds`、`assigneeState = active`、`reassigned`。決定被接受時的原子 `+1` 讓依舊狀態算好的改派一定失敗重讀(已有決定 → `ALREADY_DECIDED`)。計畫固定:之後補建任務不會把原承辦人建回來。
- **新增審核者**:只對「解析為空」而阻擋的關卡(`blocked` 且計畫為空);CAS 追加一項(`taskKey` 接在最大序號之後)、`assignee_added`;推進建任務、解除阻擋。
- **審核者失效 hook**(`assignee-invalidation.service.ts`):使用者管理的停用(`setUserEnabled(false)`,已停用再停用一次也會補做)與所屬組織異動(`setUserOrgs` 移除組織後)呼叫;對「進行中關卡、尚無決定、此刻已不合格(停用或已不在該租戶)」的計畫項目 CAS `assigneeState = invalid`、`history: blocked`;該關 `any` 且仍有有效未決定的項目 → 不阻擋,否則該關與實例 `blocked`。推進同步任務投影(→ `blocked`)與提交的 `blocked`。已被接受的決定不受影響。
- **角色來源派單後被移除角色的人仍可審**(計畫固定);被停用 / 移出租戶走失效。

## 再送出、作廢、複製為新單

- **再送出**(`returned` / `withdrawn`):申請人以 `saveFormDraft` 改內容(狀態不變),再 `submitFormSubmission` → 修訂 +1、新實例從起點開始、舊實例 `superseded`。
- **作廢**(`voidSubmission`;綁流程且 `completed`;申請人本人或有該模組 `edit`;理由必填;不需審核)→ `voided`、稽核。
- **複製為新單**(`copySubmissionToDraft`;來源 = 已作廢、讀者讀得到全部內容;目標 = 同表單目前可新增的版本):只複製讀者對來源有 `show`、目標版本有同 key 同型別的使用者填欄位、讀者對目標有 `edit` 的欄位;`computed` / `constant` 由目標版本重算;引用重驗來源可讀(`LookupProvidersService`),失效 → 清空並列在回傳的 `clearedFields`;附件以 `StorageService.copyPrivateObject` 複製一份歸新單;`clientRequestId` 去重;新草稿記 `copiedFrom`、來源記 `replacedById`。

## 讀取授權(`canReadSubmissionRevision`)

`workflow-engine/submission-read-access.service.ts`;`formSubmission(id, revision)`、附件簽名網址、`workflowInstance(id)` 都走它。

| 誰                                          | 能看什麼                                                   |
| ------------------------------------------- | ---------------------------------------------------------- |
| 模組 `view` + 可見範圍 + 資料範圍者         | 6a 原規則(全部修訂)                                        |
| 申請人(`createdBy = 我`)                    | 自己的提交(單筆,含所有修訂與歷程);列表不放寬               |
| 任務持有者(現在或曾經:含已取消、被改派走的) | **只有**他審的那幾個修訂的快照 + 那些實例的歷程;附件同範圍 |

- 任務持有者讀提交:`revision` 省略 = 他可讀的修訂中最新的一個;摘要改用該修訂**實例上的快照**、`revisions` 只列可讀的、`abilities` 全為 false。讀不到的修訂 → `FORBIDDEN`。
- `formRuntimeVersion`:沒有業務模組權限、但持有(或曾持有)這張表單任務的人也拿得到定義(申請中心詳情頁不經業務模組頁面權限)。
- 以讀者的租戶為邊界找提交;停用 / 移出租戶的人本來就進不來。

## 申請中心

`apply-center/apply-center.service.ts`,都以 `tenantId` 為邊界、跨模組,不套可見範圍與資料範圍:

- `myApplications`:`createdBy = 我` 且(走過流程,或該表單目前綁了流程);`activeSteps` 是目前實例進行中的關卡(平行時多個)。
- `applicableForms`:我有 `create`、可新增、且本租戶綁了流程的表單,依模組分組。
- `myTasks`:`assigneeId = 我`;`done = false` 待處理(`pending`)/ `true` 已處理(`approved` / `rejected` / `returned` / `late`)。**摘要與申請人讀實例快照**。
- `workflowInstance`:授權同 `canReadSubmissionRevision`;`myTasks` 欄位是讀者自己在這個實例的任務,`abilities.canWithdraw` = 申請人、進行中、還沒有決定。

## 通知信

`workflow-engine/workflow-notifier.service.ts`:任務建立(給審核者)、有結果(核准 / 駁回 / 退回,給申請人;駁回 / 退回附理由)。撤回是申請人自己的動作、`superseded` 不通知。

- 開關 `WORKFLOW_MAIL_ENABLED`(普通 env,`"true"` 才寄,每次寄信時讀;`docs/env-registry.md`):關閉時只寫 log。收件受既有 `MAIL_ALLOWLIST` 約束。
- **盡力通知**:寄信失敗只記 log、不影響推進。「寄過沒」看 `history`:任務信 = 該 `taskKey` 的 `task_created`;結果信 = `notified`(帶 `result`,與流程完成事件 `completed` 分開)——寄出(或關閉時只記 log)後追加,重試推進不重寄,但不保證恰好一次。
- 內容只讀實例快照(表單名、實例上的標題槽、關卡名),連結 `<ADMIN_APP_URL>/apply-center/view-page/<實例 id>`。模板在 `apps/api/src/mail/mail-templates.ts`(品牌文字登記 `docs/branding.md`)。

## 阻擋清單

`workflow-engine/blocked-instances.service.ts`(`blockedInstances`,以操作者的租戶為邊界):

- `BLOCKED`:實例 `status = blocked`。
- `NEEDS_ADVANCE`:對候選實例跑一次判斷表(`WorkflowEngineService.planOf`,不寫入),還有動作 = 需要推進 —— 直接對應判斷表的列 2 / 4 / 4b / 4c / 5 / 5b / 6 / 7 / 8 / 8b 與資料矛盾;另加 `linking` 超過 10 分鐘。候選 = 進行中 + 終局未收尾(`finishedAt` 空)+ 任務仍待處理 / 阻擋的實例。

## admin 頁面

(畫面在票 C:申請中心兩頁籤與詳情、流程管理的設計器 / 版本面板 / 分派 / 阻擋清單、表單管理的流程綁定欄、審核區塊。)

## api 介面

GraphQL 文件:`packages/graphql/src/documents/workflows.graphql`(設計、綁定、阻擋清單)、`apply-center.graphql`(申請中心、決定、提交的撤回 / 作廢 / 複製)。

**設計端**(`@RequirePermission` 守端點,「是不是自己的流程 / 站在哪裡」在 service):`workflows`、`workflow`、`workflowVersion(workflowKey, version?)`(省略 = 草稿)、`workflowVersions`、`validateWorkflowVersion`(query,不落庫)、`createWorkflow`、`updateWorkflow`、`forkWorkflow`、`createWorkflowVersionDraft`、`saveWorkflowVersionDraft`、`publishWorkflowVersion`、`retryPublishWorkflowVersion`、`retireCurrentWorkflowVersion`、`assignWorkflowToTenants`、`revokeWorkflowFromTenant`。

**綁定**(`system.forms.edit`、站在租戶內):`bindFormWorkflow`、`unbindFormWorkflow`(回 `FormPayload`)、`formWorkflowOptions(formKey)`、`FormModel.workflowBinding`。

**阻擋清單**(`system.workflows.blocked-page.reassign`):`blockedInstances`、`reassignTask`、`addStepAssignee`、`retryAdvanceInstance`。

**申請中心**:`myApplications`、`applicableForms`、`myTasks`(`apply-center.view`)、`workflowInstance`、`decideTask`(不看頁面權限);提交的 `withdrawSubmission`、`voidSubmission`、`copySubmissionToDraft`(在表單執行端的 resolver,回 `FormSubmissionPayload`)。

input 欄位的缺席 / `null`:

- `CreateWorkflowVersionDraftInput.baseVersion`:缺席 / `null` = 空白草稿。
- `WorkflowDefinitionInput.edges`:缺席 / `null` / 空陣列 = 直線(存 `null`)。
- `ValidateWorkflowVersionInput.checkFormKey`:缺席 / `null` = 跳過條件對第一個 `field` 來源的表單驗;都沒有 → 只驗形狀。
- `DecideTaskInput.comment`:缺席 / `null` / 空白 = 沒有理由(駁回 / 退回時 → `VALIDATION_FAILED` `comment`)。
- `MyApplicationsInput` / `MyTasksInput` 的篩選欄位缺席 = 不篩;`MyTasksInput.done` 缺席 = 待處理。

輸出欄位:

- `WorkflowTaskModel.summary` / `WorkflowInstanceModel.summary` 是**實例上的**快照(該修訂的標題槽),不是提交最新的摘要。
- `WorkflowTaskPayload.result`:`decideTask` 回 `ACCEPTED` / `STEP_CLOSED`;改派 / 新增審核者一律 `ACCEPTED`。
- `WorkflowModel.hasRolePlaceholder`:目前發布版含角色佔位(共用流程),租戶不能直接綁。`boundForms` 只有租戶視角有(本租戶的綁定);`assignments` 只有 root 視角的共用流程有。
- **`abilities` 含權限**(業務模組那一種,前端直接用):`WorkflowAbilities`、`WorkflowInstanceAbilities`、`FormSubmissionAbilities` 的 `canWithdraw` / `canVoid` / `canCopy`(見 `docs/modules/forms.md`「api 介面」)。
- `FormSubmissionModel.clearedFields`:只有 `copySubmissionToDraft` 的回傳有值。

## 錯誤

通用碼照 GQL-04,不新增 code;「為什麼」放 `extensions.reason`(正本 `apps/api/src/workflows/workflows-error.ts`)。

- `CONFLICT`:`DRAFT_REVISION_MISMATCH`、`DRAFT_EXISTS`、`DRAFT_MISSING`、`PUBLISH_IN_PROGRESS`、`PUBLISH_NOT_INTERRUPTED`、`NO_CURRENT_VERSION`、`CURRENT_VERSION_CHANGED`、`EDIT_VERSION_MISMATCH`、`STATUS_MISMATCH`、`HAS_DECISIONS`(撤回:已有審核意見)、`ALREADY_DECIDED`(改派:此任務已決定)、`ALREADY_IN_STEP`(改派 / 新增:此人已在本關)、`INSTANCE_CHANGED`(實例已結束、關卡已前進、不是解析為空的阻擋、一直被別的動作搶先)。
- `FORBIDDEN`:`ROOT_ONLY`、`NOT_WORKFLOW_OWNER`、`TENANT_ONLY`、`WORKFLOW_REMOVED` / `WORKFLOW_UNPUBLISHED` / `WORKFLOW_MISCONFIGURED`(送出時檢查,後者附 `issues`;綁定時沒有發布版也是 `WORKFLOW_UNPUBLISHED`)、`ASSIGNEE_NOT_ELIGIBLE`(改派 / 新增的對象停用、不在本租戶或是申請人)。
- `VALIDATION_FAILED`:發布的檢查器錯誤 → `fields: ["definition"]` + `issues`(`@repo/domain/workflow` 的 `WorkflowIssue`);綁定時檢查 → `fields: ["workflowKey"]` + `issues`(`BindingIssue`);其餘照一般的 `fields`。
- 送出時檢查擋下的訊息給申請人看的是「流程設定有誤,請聯絡管理員」「流程尚未發布」「此表單的審核流程已移除,請聯絡管理員」(`SUBMIT_CHECK_MESSAGES`),前端依 reason 對應。

## 稽核

| action                                                                                      | targetType          | 記什麼                                           |
| ------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------ |
| `workflow.create` / `.update` / `.fork` / `.assign` / `.revoke`                             | `workflow`          | key、名稱、fork 來源、分派的租戶                 |
| `workflow-version.create-draft` / `.save-draft` / `.publish` / `.retry-publish` / `.retire` | `workflow_version`  | workflowKey、版號、draftRevision、changelog      |
| `form.bind-workflow` / `form.unbind-workflow`                                               | `form`              | 綁定前後的流程                                   |
| `task.decide` / `task.reassign`                                                             | `workflow_task`     | 決定種類 / 改派前後的承辦人                      |
| `task.add-assignee` / `instance.retry-advance`                                              | `workflow_instance` | 關卡、taskKey、新增的人                          |
| `submission.submit` / `.withdraw` / `.void` / `.copy`                                       | `form_submission`   | 修訂號、流程版本、作廢理由、複製來源(**不記值**) |
