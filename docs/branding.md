# 品牌註冊表

**規則:任何新增或異動「品牌文字、圖案、色彩、網域」的地方,必須同步更新本表**(新增列或修訂),否則換品牌時會漏。AI 與人同守;review 時檢查。

換品牌 = 逐列處理下表 + 主色一行(`createBrandFromPrimary` 的 hex)。

## 程式碼

| 位置 | 內容 | 怎麼改 |
|---|---|---|
| `packages/ui/src/theme/brand.ts` | `cookhomeBrand`(主色來源,全 theme 由此衍生) | 換 primary hex 一行;export 名稱可 alias 保留 |
| `apps/storybook/.storybook/preview.tsx` | import `cookhomeBrand` | 隨上列改名連動 |
| `apps/admin/src/lib/locale.ts` | localStorage key `cookhome-admin-locale`(AppBar 語言切換器寫入,#66) | 換品牌 slug(舊 key 的既存值會失效,可接受) |
| `apps/api/src/app.module.ts` | 預設 MongoDB 連線 `mongodb://localhost:27017/cookhome` | 換 db 名(僅本機預設,正式環境走環境變數) |
| `apps/api/src/mail/mail-templates.ts` | 信件(啟用信、重設密碼信):寄件人 `MAIL_SENDER` = `CookHome <no-reply@cookhome.online>`、品牌名「CookHome」(主旨前綴「【CookHome】」、內文「CookHome 後台帳號」)、署名「CookHome 後台管理系統」 | 改該檔頂部的 `MAIL_SENDER` / `BRAND_NAME` / `SIGNATURE` 三個常數;寄件網域須同步在 Resend 完成 SPF / DKIM 驗證(ADR-0010) |
| 網域 | `cookhome.online`、`design.cookhome.online`(deploy 設定 / DNS / Storybook 部署) | DNS + `.github/workflows/deploy.yml` 相關設定 |
| `apps/admin/index.html` | `<title>CookHome 後台管理</title>`(favicon 為 Vite 鷹架預設 `public/favicon.ico`,尚未換品牌圖) | 換 title 文字 / 換 favicon 檔 |
| `packages/i18n/messages/*/common.json` `brand` | 「CookHome」(admin 登入頁 LoginCard 品牌名、footer 的 {brand}) | 改兩語系的值 |
| `packages/i18n/messages/*/admin.json` `login.subtitle` / `login.footer` | 「後台管理系統」/「© {year} {brand} · 僅供授權人員使用」(對應 Figma LoginCard 17:8 / 17:26,#65) | 改兩語系的值 |
| `packages/i18n/messages/*/admin.json` `app.subtitle` | 「後台管理」(SideNav 頂部組織名稱下方的副標,對應 Figma AdminSideNav 25:43,#66) | 改兩語系的值 |
| `apps/admin/src/features/shell/side-nav.tsx` | SideNav 頂部顯示**當前組織名稱**(資料,`me.currentOrg.name`;無當前組織時退回 `common.brand`);商標圖槽位(Figma 120:50)保留註解、第 3 段接 StorageService 簽名讀取(#66) | 顯圖時在此接 `orgs.logoPath` |
| `apps/admin/src/lib/auth/session-channel.ts` | BroadcastChannel 名稱 `cookhome-admin-session`(分頁登出同步) | 換品牌 slug |
| 各 app metadata title / favicon(front) | (實作畫面時逐一登記於此) | — |

## [Figma:CookHome Design System](https://www.figma.com/design/SvnBvi8Opfj8daJAclOnWW)(Wowgo 團隊,fileKey `SvnBvi8Opfj8daJAclOnWW`)

| 位置 | 節點 | 內容 |
|---|---|---|
| Admin 登入 LoginCard | 17:7 / 17:8 / 17:26 | 「CookHome」「後台管理系統」「© 2026 CookHome…」(忘記密碼、設定新密碼頁為其複本,共 4 張圖同步改) |
| Draft/AdminSideNav 元件 | 25:42(brandName)/ 120:50(logoImg 槽) | 頂部租戶識別:預設文字,ShowLogo=true 換商標圖;改元件即全畫面連動 |
| Draft/FrontAppBar | 36:4(Desktop)/ 38:5(Mobile) | 前台 logo 文字 |
| Draft/FrontFooter | 36:25 / 36:30(Desktop)、38:11 / 38:13(Mobile) | 品牌名 + © 行 |
| Foundations / Cover | — | 主色變數 `primary/*`(6:43–6:48)由主色衍生;Cover 頁標題 |

## 資料

| 位置 | 內容 | 說明 |
|---|---|---|
| `orgs`(根組織)`name` | 「CookHome」 | AppBar orgSwitcher、清單等顯示的是組織名稱(資料),換品牌時改根組織名 |
| `orgs.logoPath` | 各組織商標的 GCS 物件路徑(nullable) | 租戶自有商標;SideNav 頂部 ShowLogo 顯示(API 簽名讀取,ADR-0010),無值則顯示組織名稱文字 |
