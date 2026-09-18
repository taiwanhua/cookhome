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

## 本專案 ADR 導讀(依理解順序,非編號順序)

想理解底座如何運作,照這個順序讀:

1. **0003 帳號體系** — 使用者/會員分離、所屬組織、角色授予、移除規則
2. **0004 權限模型** — 模組=頁面、權限=頁面裡的東西、wildcard、防越權
3. **0011 查詢與判斷流程** — 登入後查什麼表、前端怎麼判斷(資料流總圖)
4. **0005 多租戶隔離** — orgId、可見範圍、BaseRepository 自動過濾
5. **0008 資料範圍** — 規則產生器(查資料的上限)
6. 依需要查:**0009** 租戶開通、**0001** 核心關聯、**0002** 種子與遷移、**0007** 基礎欄位、**0010** 儲存與寄信、**0006** OAuth(延後)、**0012** 前端程式碼風格與分層(寫前端程式碼前必讀)

讀完 1–5 即有全貌。各模組的具體畫面、權限表、資料定義在 `docs/modules/<key>.md`。

## 使用詞彙表的用語

當產出內容涉及領域概念(issue 標題、重構提案、假設、測試名稱)時,使用 `CONTEXT.md` 定義的術語,不要偏移到詞彙表明確避免的同義詞。

如果需要的概念還不在詞彙表裡,這本身就是訊號 — 要嘛你正在發明專案沒有使用的語言(請重新考慮),要嘛存在真正的缺口(記下來留給 `/domain-modeling`)。

## 標記與 ADR 的衝突

如果產出內容與既有 ADR 矛盾,明確指出,而不是默默地推翻:

> _Contradicts ADR-0007 (event-sourced orders) — 但值得重新討論,因為…_
