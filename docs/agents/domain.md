# 領域文件(Domain Docs)

engineering skills 在探索 codebase 時,應如何使用本 repo 的領域文件。

## 探索前先讀這些

- repo 根目錄的 **`CONTEXT.md`**,或
- repo 根目錄的 **`CONTEXT-MAP.md`**(如果存在)— 它指向每個 context 各自的 `CONTEXT.md`,讀取與主題相關的那幾份。
- **`docs/adr/`** — 讀取與即將動工區域相關的 ADR。多 context 的 repo 還要查 `src/<context>/docs/adr/` 裡限定該 context 的決策。

如果這些檔案不存在,**安靜地繼續**。不要特別指出它們不存在,也不要主動建議先建立。`/domain-modeling` skill(經由 `/grill-with-docs` 與 `/improve-codebase-architecture` 觸發)會在術語或決策真正被敲定時才惰性建立它們。

## 檔案結構

單一 context 的 repo(絕大多數):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多 context 的 repo(根目錄存在 `CONTEXT-MAP.md`):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← 全系統層級的決策
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← 限定此 context 的決策
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## 使用詞彙表的用語

當產出內容涉及領域概念(issue 標題、重構提案、假設、測試名稱)時,使用 `CONTEXT.md` 定義的術語,不要偏移到詞彙表明確避免的同義詞。

如果需要的概念還不在詞彙表裡,這本身就是訊號 — 要嘛你正在發明專案沒有使用的語言(請重新考慮),要嘛存在真正的缺口(記下來留給 `/domain-modeling`)。

## 標記與 ADR 的衝突

如果產出內容與既有 ADR 矛盾,明確指出,而不是默默地推翻:

> _Contradicts ADR-0007 (event-sourced orders) — 但值得重新討論,因為…_
