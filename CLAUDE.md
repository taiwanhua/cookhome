# CookHome

## Git 工作流程(分支 ↔ 環境)

`main`=production、`staging`=預發布、`dev`=開發測試。規則:

- feat 分支**一律從 `main` 切出**;完成後 PR 合併到 `dev` 做整合測試(CI 綠才 merge)
- 通過測試、要上線的 feat 分支,**逐一** PR 合併到 `staging` 做預發布驗證
- 發布 = `staging` PR 合併回 `main`;release 後進行中的 feat 分支 rebase 到最新 `main`
- `dev` 汙染時整支重置:`git checkout dev && git fetch && git reset --hard origin/main && git push --force origin dev`
- **部署一律手動觸發 deploy.yml**(merge 不自動部署):Actions UI 或 `gh workflow run Deploy --ref <分支> -f environment=<dev|staging|production>`
- 不直接 push `main`(僅文件/設定微小修正例外);此為紀律約定(免費方案無 branch protection),AI 與人同守

## Coding standards

寫或改程式碼前,先讀 `docs/standards/README.md` 的索引,只載入與改動範圍相關的規範檔;review 時引用規則編號(如 `REACT-02`)。review 中被採納的新決定要回寫進對應規範檔。

凡新增或異動品牌文字、圖案、色彩、網域(程式碼或 Figma),必須同步更新 `docs/branding.md` 品牌註冊表。

## Agent skills

### Issue tracker

Issues 追蹤在 `taiwanhua/cookhome` 的 GitHub Issues,透過 `gh` CLI 操作。見 `docs/agents/issue-tracker.md`。

### Triage labels

使用預設標籤詞彙:`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。見 `docs/agents/triage-labels.md`。

### Domain docs

單一 context:repo 根目錄的 `CONTEXT.md` + `docs/adr/`(由 `/domain-modeling` 惰性建立)。見 `docs/agents/domain.md`。

- 開發/修改後台模組 → 先讀 `docs/modules/<key>.md`(內部技術文件)+ `apps/admin/src/md/module-help/<key>.help.md`(租戶使用者說明:守詞彙表、不得出現平台視角詞彙;build 時打包進說明彈窗)
- 設計稿 → [Figma:CookHome Design System](https://www.figma.com/design/SvnBvi8Opfj8daJAclOnWW)(頁面結構:Foundations / 各元件頁 / Screen 系列;規範見 `docs/standards/general/figma.md`)
- 進行中討論與待辦 → `docs/tmp/dis.md`
- 底座 schema 草案 → `docs/tmp/base-schema.md`(實作時轉正)
