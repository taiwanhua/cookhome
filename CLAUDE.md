# CookHome

## Coding standards

寫或改程式碼前,先讀 `docs/standards/README.md` 的索引,只載入與改動範圍相關的規範檔;review 時引用規則編號(如 `REACT-02`)。review 中被採納的新決定要回寫進對應規範檔。

## Agent skills

### Issue tracker

Issues 追蹤在 `taiwanhua/cookhome` 的 GitHub Issues,透過 `gh` CLI 操作。見 `docs/agents/issue-tracker.md`。

### Triage labels

使用預設標籤詞彙:`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。見 `docs/agents/triage-labels.md`。

### Domain docs

單一 context:repo 根目錄的 `CONTEXT.md` + `docs/adr/`(由 `/domain-modeling` 惰性建立)。見 `docs/agents/domain.md`。
