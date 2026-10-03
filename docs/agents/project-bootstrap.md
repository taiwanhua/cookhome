# 新專案初始化

從底座正式版本建立一個新的引用專案:保留共同 Git 歷史、把專案值寫進既有來源、建立或停用外部整合,並分開記錄驗證結果。本檔是這套操作的唯一正本;各工具的 skill 入口只指到這裡。

要設定哪些項目、值放哪、怎麼算驗過,清單在[初始化索引](../project-initialization.md),本檔不重抄;這裡只寫順序、Git 操作、版本欄位與重跑規則。

## 適用與邊界

- **適用**:建立新的引用專案,或接續一次尚未完成的初始化。
- **不適用**:替既有專案換品牌、升級底座版本、還原資料庫。升級見 [deployment](../deployment.md#底座首次接軌與版本升級),還原見 [deployment](../deployment.md#資料庫還原reset)。初始化不會靜默更換既有專案的 slug、資料庫、volume 或上游版本。
- **不新增格式或工具**:專案值沿用既有的 TypeScript / JSON / YAML / env 來源,沒有另外的 manifest、狀態檔或 CLI wizard。唯一新增的是根 `package.json` 的 `wowgoBase` 欄位(見第 3 節)。
- **授權沿用現況**:建 repo、雲端、看板、DNS、部署等外部操作,依使用者已授權的範圍與實際提供的輸入執行;本流程不擴大授權,也不對已授權的範圍逐步重問。E2E 仍依 [issue tracker](issue-tracker.md) 由使用者決定是否觸發。
- **機密不落檔**:密碼、金鑰、連線字串不寫進版控檔、issue、PR 或回報;建立方式見 [deployment](../deployment.md#新增一個-secret-manager-機密的標準步驟)。文件與範例裡的值都是示意,不是可用的憑證。

## 開始前

1. 讀 `CLAUDE.md`、[初始化索引](../project-initialization.md)、[品牌註冊表](../branding.md)、[環境變數登記](../env-registry.md)、[deployment](../deployment.md),以及索引指到的實際來源檔。指令與欄位以來源檔為準;本檔與來源不合時停下回報。
2. 確認底座正式版本可取得:首版是不可移動的 annotated tag `v0.1.0` 加 GitHub Release。**拿不到正式 tag 時停止**,不以底座 `main` 的最新 commit 代替。
3. 進度記在新專案的 issue / PR,依[協作規則](collaboration.md)讓下一位只靠 repo 與 issue 就能接手;不另建進度檔。每個項目分三種狀態記錄,定義見初始化索引:**已提供**、**已建立**、**已驗證**。

## 1. 收集輸入

逐節對照初始化索引,列出還缺的輸入一次問完;使用者或 issue 已回答的直接沿用。

| 類別       | 要取得的輸入                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Repo       | 新 repo 的 owner/名稱、可見性、本機位置;底座 repo URL 與採用的 tag                                                 |
| 品牌       | slug、品牌名、主色、admin title、前台各語系 metadata、favicon 等資產、寄件信箱與署名                               |
| 初始資料   | 根組織名稱與描述、各模組初值、專案模組與受管定義                                                                   |
| 本機       | Compose 專案名、`LOCAL_*` 的 DB 名與三個 port、各 app 的 `.env` 值、E2E 的 Compose 專案名 / DB / port / bucket     |
| 外部整合   | 資料庫、GCP 與部署、GitHub 看板、Vercel、DNS、Resend、GCS、Figma 與開發工具:每一項是「啟用並給識別」或「明確停用」 |
| 業務與前台 | 要保留、替換或移除的來源業務內容;前台畫面與風格由專案自己設計,不強制沿用 admin 主題                                |

外部識別未知時記為缺項,不填假值、不沿用來源專案的資源。

## 2. 取得底座版本並建立 repo

新專案必須帶底座的完整歷史。不使用淺層 clone、GitHub Template、複製檔案後 `git init`、`push --mirror` 或 `push --all`。

```bash
git clone --origin upstream --no-tags --no-checkout <底座 repo URL> <本機位置>
cd <本機位置>
git fetch upstream --no-tags refs/tags/<tag>:refs/remotes/upstream/releases/<tag>
git cat-file -t refs/remotes/upstream/releases/<tag>
git rev-parse "refs/remotes/upstream/releases/<tag>^{commit}"
git rev-parse --is-shallow-repository
git switch -c main <完整 commit>
```

- `cat-file -t` 必須印出 `tag`(annotated);`rev-parse` 的 40 位 commit 必須與該版 GitHub Release 記載的一致;`--is-shallow-repository` 必須是 `false`。任何一項不符就停止。
- `--no-tags` 讓底座 tag 留在 `refs/remotes/upstream/releases/`,不進專案自己的 `refs/tags/`;`git tag -l` 應為空。

建立空的新 repo(不帶 README、不用 template)後接上 `origin`,只推明確指定的分支:

```bash
git remote add origin <新 repo URL>
git push origin main:refs/heads/main main:refs/heads/dev main:refs/heads/staging
```

三條分支的起點都是已核對的底座 commit,這是唯一一次直接寫入 `main`。之後的所有專案變更(含本次初始化)從 `main` 切 feat 分支,依 `CLAUDE.md` 的分支流程走 PR,不直接提交 `main`。

## 3. 寫入專案值

在 feat 分支上依初始化索引逐節改既有來源。順序如下,前一項的值會被後面引用:

1. **根 `package.json`**:`name` 改為專案名,並新增採用版本欄位:

   ```json
   "wowgoBase": {
     "repository": "<底座 Git URL>",
     "tag": "v0.1.0",
     "commit": "<第 2 節核對的 40 位 commit>"
   }
   ```

   這個欄位只記錄採用來源,讓新 clone 讀得到;它不取代 Git ancestry,兩者都要成立。底座 repo 自己不填這個欄位。之後升級時,在同一個升級 PR 更新它。

2. **品牌與信件**:`packages/project-config/src/project/public.ts`、`mail.ts`。新專案的 `compatibility.legacySideNavStorageKey` 為 `null`。同步更新品牌註冊表。
3. **初始資料**:`apps/db-migrator/seeds/project/settings.ts`(根組織、模組初值)與 `registry.ts`(專案模組、受管定義)。
4. **Repo 與看板**:`deploy/project/github.json` 的 `expectedRepository` 改為新 repo;不用看板時 `projectStatus.enabled` 設 `false`,要用就填新看板自己的 ID。
5. **雲端**:尚未啟用時 `deploy/project/cloud.json` 只留 `{"schemaVersion":1,"enabled":false}`;啟用時填新專案完整的三環境設定。`deploy/env/<環境>.yaml` 不留來源專案的網域或 bucket,尚無值的鍵依[環境變數登記](../env-registry.md)所列的未設行為省略。
6. **本機**:根與各 app 的 `.env.example` 改為專案的範例值;未追蹤的 `.env` 只在不存在時建立。Compose 專案名、DB 名與 port 要與同機其他專案錯開(規則見初始化索引「本機與測試環境」)。
7. **業務、前台與文件**:依輸入處理來源業務內容、前台文案與風格、favicon;`CLAUDE.md`、`CONTEXT.md` 等入口的專案識別改為新專案。

不對 repo 做全域取代。已發布的 migration、seed 歷史快照、相容夾具裡的來源品牌字串維持原樣;要檢查的是實際執行與部署的目標是否還指向來源專案。

採用的底座版本若缺少上述某個機制(例如讀取器拒絕 `cloud.json` 的 `enabled`、根目錄沒有 `.env.example`),停下回報缺口,不在初始化裡自行補寫底座程式。

## 4. 外部資源

依輸入與授權建立,步驟以 [deployment](../deployment.md) 為準(Secret、GCS bucket 與 IAM、Vercel、網域),看板與 `GH_PROJECT_TOKEN` 見 [issue tracker](issue-tracker.md)。新專案使用自己的資源與密鑰。

設定檔寫好只算**已提供**;資源實際存在才是**已建立**;以新專案跑過實際連線、部署或移卡才是**已驗證**。停用的整合記為「已停用」,不記成已建立。

## 5. 驗證

指令的寫法與注意事項以 [toolbox](toolbox.md) 為準。

- **Git**:`git remote -v`(`origin` 是新 repo、`upstream` 是底座)、`git merge-base --is-ancestor <wowgoBase.commit> HEAD`、`git rev-parse --is-shallow-repository` 為 `false`、`git tag -l` 沒有底座 tag。
- **設定讀取器**:`node --test scripts/project-settings/*.test.mjs`,再以新 repo 身分跑 `read-config.mjs` 的 github scope 與三個環境的 cloud scope(指令見 [deployment](../deployment.md#專案部署設定deployproject))。雲端停用時輸出是 `{"enabled":false}`,這只證明停用狀態有效。
- **程式**:`pnpm exec turbo run test --filter=@repo/project-config`,再對改到的 package 跑 lint、型別、測試與 build;最後 `pnpm run format:check`。
- **初始資料**:在明確建立的拋棄式空資料庫,依 [deployment](../deployment.md#設定與資料更新)執行 `update` 並原樣重跑一次;再對第二個空庫做同樣的事,確認受管定義內容一致,而組織、帳號、ID 與分派各自獨立。
- **本機隔離**:`docker compose config` 只核對渲染結果。兩個專案同時啟動、停一邊不影響另一邊,要實際操作過才算驗證。
- **E2E**:只提建議與理由,不自行觸發。

沒跑的項目照實列為未驗證,並寫明原因(缺輸入、缺授權、外部資源不存在、底座版本缺機制)。

## 重跑

先核對再動手:`origin` 是否為這個專案、`package.json` 的 `wowgoBase` 與實際 ancestry 是否一致、各來源檔的現值。

- 只補缺項,或改使用者這次明確要求變更的欄位。
- 不覆寫已客製的來源、已存在的 `.env`、業務內容與資料。
- slug、資料庫名、Compose 專案名與 volume、底座版本一旦定下,初始化不更動;要換底座版本走升級流程。
- 現值與 issue 記錄不一致時,列出差異請使用者裁決。

## 回報

在 issue / PR 依 issue tracker 的交件格式回報,並附:採用的底座 repo / tag / commit、每個項目的三種狀態、停用的整合、未驗證項與原因、仍缺的輸入。全部檔案改完不等於初始化完成;以這份狀態紀錄為準。

## 本流程的驗證範圍

第 2 節的 Git 指令已在本機拋棄式 repo 核對過行為(annotated tag、完整歷史、tag 不進 `refs/tags/`、ancestry)。以正式底座 tag 建立真實新專案的完整演練尚未執行;在那之前,外部資源建立、雙專案同機隔離與跨環境受管定義一致性,都只有來源文件的規則,沒有本流程的實測結果。

正本:本檔;設定項目與驗證責任 `docs/project-initialization.md`;Git 與部署操作 `docs/deployment.md`;採用版本欄位在引用專案根 `package.json` 的 `wowgoBase`
