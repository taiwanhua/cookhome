# @repo/e2e — 權限劇本的 E2E

`docs/testing/permission-scenarios.md` 的 17 條劇本,逐條改成 Playwright spec。
**只在手動觸發時跑**(本機 `pnpm e2e`、CI 的 `.github/workflows/e2e.yml`),不進每個 PR 的 CI ——
理由與寫法規範見 `docs/standards/testing/testing.md` 的 TEST-05 與 TEST-11。

## 怎麼跑

```bash
pnpm --filter @repo/e2e e2e:browser   # 第一次:只裝 chromium
pnpm e2e                              # 全部劇本
E2E_GREP="劇本 7" pnpm e2e            # 只跑某一條(`--` 之後的旗標穿不過 `pnpm --filter`)
```

`pnpm e2e` 會自己做完這一串,不需要事先起任何東西:

1. `turbo run build --filter=@repo/api --filter=@repo/admin`
   (admin 的 api 端點是 build 時烘進 bundle 的,所以埠一改就要重建)
2. 起 Mongo:沒給 `E2E_MONGODB_URI` 就用 `mongodb-memory-server`
3. `db-migrator migrate` → `seed`(`ROOT_ADMIN_*` 用測試值)
4. 起 api(`node apps/api/dist/main.js`,子行程;stdout 導到 `.tmp/api.log`)
5. 起 admin(`vite preview` 的程式介面,吃 `apps/admin/dist` 的靜態檔)

跑完 `globalTeardown` 會把三者收掉。報告在 `playwright-report/`(失敗時附 trace 與截圖)。

本機反覆跑同一條時,`E2E_SKIP_BUILD=1` 省掉重建;接在自己手動起好的 stack 上除錯用 `E2E_SKIP_STACK=1`。
變數清單見 `.env.example`。

## 檔案怎麼分

```
apps/e2e/
├── playwright.config.ts      只裝 chromium、workers=1、globalSetup / globalTeardown
└── src/
    ├── config.ts             埠 / 主機 / 測試帳密(全部走環境變數,預設值在這裡)
    ├── harness/              起 stack 與收 stack(process.ts 是 spawn / 等待的小工具)
    ├── fixtures/             前置資料(全部走 api)、共用的畫面定位與登入
    └── specs/                一條劇本一個 spec:scenario-<兩位數>-<主題>.spec.ts
```

## 三條約定(TEST-11)

- **前置走 api,UI 只走要驗的那一段**:開通租戶、建組織 / 使用者 / 角色、調權限矩陣、建業務資料
  一律用 GraphQL(`fixtures/api.ts`);畫面只負責跑劇本的「預期」在講的那幾步。
- **一條劇本一個租戶**:租戶是產品本身的隔離邊界(ADR-0005),`tenant` fixture 每次開一個新的,
  名稱帶隨機字尾;所以同一個資料庫上重跑、或之後放大平行度都不會互相污染。
- **一條劇本一個 spec**,檔名帶劇本編號;spec 的註解指回 `permission-scenarios.md` 的那一條,
  步驟註解照文件的步驟編號寫,對不上時以文件為準。
