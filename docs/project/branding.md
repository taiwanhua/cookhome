# CookHome 品牌值

本專案在[品牌註冊表](../branding.md)各列的實際值。規則、列的定義與「怎麼改」以註冊表為準;這裡只列與底座不同的值,列名沿用註冊表。新增或異動品牌文字、圖案、色彩、網域時,值寫在這裡,新增的列(新的儲存鍵、新的品牌位置)同時補進註冊表。

## 專案識別

CookHome 是引用專案,repo 是 [taiwanhua/cookhome](https://github.com/taiwanhua/cookhome),底座是 [taiwanhua/wowgo-base](https://github.com/taiwanhua/wowgo-base)。

## 程式碼

| 註冊表的列                                      | 本專案的值                                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/project-config/src/project/public.ts` | `slug` = `cookhome`、`brand.name` =「CookHome」、`brand.primary` = `#FB7B10`、`admin.documentTitle` =「CookHome 後台管理」、`admin.webApp` = `null`(沒有 app 圖示,不可安裝)、`front.metadata` =「CookHome — 家常食譜」/「CookHome — Home-style Recipes」等 |
| `compatibility.legacySideNavStorageKey`         | `cookhome.admin.sidenav`(早期點分隔的側欄收合鍵;admin 一次性搬到新鍵後刪除)                                                                                                                                                                                |
| 瀏覽器儲存鍵(全部由 slug 生成)                  | `cookhome-admin-locale`、`cookhome-admin-color-mode`、`cookhome-admin-color-scheme-light` / `-dark`、`cookhome-admin-session`(BroadcastChannel)、`cookhome-admin-route-tabs:<userId>`、`cookhome-admin-sidenav`、`cookhome-admin-sections:<userId>`        |
| favicon                                         | `apps/admin/public/favicon.ico`、`apps/front/public/favicon.ico`(鷹架預設,尚未換品牌圖)                                                                                                                                                                    |
| 本機 MongoDB 的資料庫名                         | `cookhome`(`apps/api/.env.example` 的 `MONGODB_URI`、根 `.env.example` 的 `LOCAL_MONGO_DB`);本機 replica set 名 = `COMPOSE_PROJECT_NAME` = `cookhome`                                                                                                      |
| `packages/project-config/src/project/mail.ts`   | `senderEmail` = `no-reply@cookhome.online`(寄件網域 cookhome.online 在 Resend 驗證 SPF / DKIM)、`signature` =「CookHome 後台管理系統」;寄件人 `CookHome <no-reply@cookhome.online>`、主旨前綴「【CookHome】」、內文「CookHome 後台帳號」                   |
| 網域                                            | `cookhome.online`(DNS 在 Cloudflare);各環境網址見[專案部署](deployment.md#網域與環境對照)                                                                                                                                                                  |
| 即時通道網域                                    | `rt-dev.cookhome.online`(dev)、`rt-staging.cookhome.online`(staging)、`rt.cookhome.online`(production);Worker 名稱在 `deploy/project/cloud.json` 的 `realtime.worker`,三環境的 `REALTIME_URL` 都已寫入 `deploy/env/<環境>.yaml`                            |
| Storybook 網域                                  | `design.cookhome.online`(Vercel 專案 `cookhome-design`,只建 `main`)                                                                                                                                                                                        |
| `orgs`(根組織)`name`                            | 「CookHome」(`apps/db-migrator/seeds/project/settings.ts` 的 `rootOrg.name`)                                                                                                                                                                               |

## 設計資源

| 檔案                                                                          | fileKey                  | 目前用途                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [CookHome Brand Library](https://www.figma.com/design/ZuPRBveUMzbnJeDCt7mFP3) | `ZuPRBveUMzbnJeDCt7mFP3` | 專案品牌資產的獨立檔;由 `projectPublic.brand` 生成兩個 Light 集合、十二個品牌變數及 `Shadow/Primary` 並發布                 |
| [CookHome Screens](https://www.figma.com/design/Wi9DIhrSILy2bj9nqXb051)       | `Wi9DIhrSILy2bj9nqXb051` | 目前的 CookHome 後台畫面;取自 Screens Starter 的 15 頁內容,共用元件為底座 Library 遠端實例、品牌引用 CookHome Brand Library |
| [CookHome Design System](https://www.figma.com/design/SvnBvi8Opfj8daJAclOnWW) | `SvnBvi8Opfj8daJAclOnWW` | 保留的舊設計檔,含既有前台與後台畫面;不再作為新版後台 Screens 的來源,沒有覆蓋或刪除                                          |

兩個畫面檔的節點 id 不可混用,節點見[專案節點表](figma-nodes.md)。

### Figma 接軌紀錄

- 引用的底座[中性內容發布](https://www.figma.com/design/XKQ18kf6SkfAQYk7GmBkk5/wowgo-base-Design-System?version-id=2406587150460058202)對應 [wowgo-base v0.2.0](https://github.com/taiwanhua/wowgo-base/releases/tag/v0.2.0);CookHome 已接受該 Library 更新。舊檔的[接軌快照](https://www.figma.com/design/SvnBvi8Opfj8daJAclOnWW?version-id=2406832891331255792)保存品牌補套後的專案畫面與正式版本對照。
- 首次接軌已依頁面盤點完成品牌補套;舊[品牌庫 receipt](../../deploy/project/figma/receipts/ZuPRBveUMzbnJeDCt7mFP3.json)與[畫面補套 receipt](../../deploy/project/figma/receipts/SvnBvi8Opfj8daJAclOnWW.json)保留為當時紀錄,不作新流程的必要輸入或當前狀態證明。前台母元件的品牌由實例繼承,正常繼承的位置保持未接管。後續接受 Library 更新後,依 [toolbox](../agents/toolbox.md#figma-品牌同步)核對受影響範圍並補綁,結果記在升級 PR。
