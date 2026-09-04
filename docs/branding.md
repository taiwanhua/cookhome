# 品牌落點清單(換皮 / 開新專案指南)

以本 repo 為模板開新專案(front + admin + api)時,品牌相關的東西**全部**在以下位置。
原則:品牌只允許出現在這份清單列出的地方 — UI 上的品牌字一律取自 `@repo/i18n` 的
`common.brand`,視覺取自 `@repo/ui` 的 brand tokens;其他地方硬編碼品牌字視為違規
(程式碼註解、文件不在此限)。守住這條,換品牌的成本永遠是固定的清單,不是全文搜尋。

## 一、程式碼內(clone 模板後逐一替換)

### 品牌文字

| 位置 | 內容 | 怎麼改 |
| --- | --- | --- |
| `packages/i18n/messages/{zh-TW,en}/common.json` | `brand` — 所有 UI 品牌顯示名的唯一來源 | 改字串 |
| `packages/i18n/messages/{zh-TW,en}/front.json` | `meta.*` — 前台 SEO title / titleTemplate / description | 改字串 |
| `packages/i18n/messages/{zh-TW,en}/admin.json` | `app.subtitle` — 後台副標 | 改字串 |
| `apps/admin/index.html` | `<title>` 與 `<html lang>`(JS 載入前的 fallback;載入後由 `app/index.tsx` 的 effect 依語言同步) | 改字串 |
| 根 `package.json` | workspace 名稱 `cookhome` | 改名 |
| `apps/admin/src/app/root.tsx` | localStorage key `cookhome-admin-locale`(避免同網域多專案互踩) | 改前綴 |
| `apps/api/src/app.module.ts` | 本地開發 Mongo fallback URI 的 DB 名(`mongodb://localhost:27017/cookhome`) | 改 DB 名 |
| `docker-compose.yml` | container 名稱 `cookhome-mongo` / `cookhome-api` / `cookhome-admin` | 改名 |

### 品牌視覺

| 位置 | 內容 | 怎麼改 |
| --- | --- | --- |
| `packages/ui/src/theme/brands/cookhome.ts` | 品牌層 design tokens(色票等),語意層與元件只認語意 token | 新增 `brands/<新品牌>.ts` 整包替換,不改語意層 |
| `packages/ui/src/theme/index.ts` | re-export 目前品牌(`export * from "./brands/cookhome"`) | 改指向新品牌檔 |
| `apps/storybook/.storybook/preview.tsx` | `createAppTheme(cookhomeBrand)` | 改 import 的 brand |
| `apps/front/public/favicon.ico` | 前台 favicon(目前是佔位圖示) | 換檔案 |
| `apps/admin/public/favicon.ico` | 後台 favicon(目前是佔位圖示) | 換檔案 |

註:front 的頁面 title/description 不在程式碼裡硬編碼 — 由 `app/[locale]/layout.tsx` 的
`generateMetadata` 從訊息檔讀,所以上表改訊息檔即可。

## 二、基礎設施(新專案各自新開,不是「改」而是「建」)

完整建立步驟見 `docs/deployment.md`;這裡只列「名字帶品牌」的資源:

- **GitHub**:repo 名;`ci.yml` / `deploy.yml` 內的 image 名、service 名、WIF provider
  條件(`repository == 'taiwanhua/cookhome'`)
- **GCP**:專案 ID(`cookhome-online`)、Artifact Registry repo、Cloud Run 服務名
  (`cookhome-api[-dev|-staging]`、`cookhome-admin[...]`)、Secret Manager 的
  `mongodb-uri*`、deployer SA 名
- **MongoDB Atlas**:cluster 名、資料庫名(`cookhome` / `cookhome_dev` / `cookhome_staging`)
- **Vercel**:專案名、環境變數、branch domains、Deploy Hooks
- **Cloudflare / 網域**:zone 本身 + 9 筆子網域 CNAME(www/dev/staging × front/api/erp)

## 三、之後的計畫

此清單是「以 cookhome 為模板 bootstrap 新專案」skill 的素材(見 `docs/tmp/dis.md`);
新專案落地時照本清單逐項替換,skill 化之後由 AI 帶參數(品牌名、網域、GCP 專案)自動跑。
