# 檔案儲存用 GCS 簽名網址直傳;交易信件用 Resend + 介面抽象

## 檔案儲存(GCS)

### 架構:兩個 bucket,實作底座時一次配好

- `cookhome-assets-{dev|staging|prod}`:**私有**(預設),uniform bucket-level access、不開公開讀
- `cookhome-public-{dev|staging|prod}`:**公開讀**(空 bucket 零成本,先建著)
- `StorageService` 介面以 **`purpose`**(用途,如 `ORG_LOGO`)決定路徑前綴、bucket 與簽發前要驗的權限;visibility 是用途的衍生屬性,不另給參數(2026-09-19 實作定案,#137)。新模組要存檔只登記一個 purpose,不再碰基建

### 上傳(私有/公開共用同一條路)

前端向 API 要 **V4 上傳簽名網址**(API 先驗:該 purpose 對應的操作者權限、檔型 PNG/JPG/WebP、大小 ≤2MB;網址效期 10 分鐘,程式常數)→ 瀏覽器**直傳 GCS** → API 寫回物件路徑。檔案不經過 API server。

### 讀取(私有與公開唯一的分岔)

- **私有**:前端經 API 取檔 — API 驗權(接資料隔離與資料範圍規則:BaseRepository 查得到該筆資料的人才可取檔)後,簽發**短效讀取簽名網址**(商標類 TTL 1 小時 = `GCS_SIGNED_URL_TTL` 預設、前端快取;敏感檔約 15 分鐘);極敏感檔案可收緊為 API 代理串流。**DB 存物件路徑(bucket+key),不存 URL**(簽名網址會過期,看時現簽)。
- **公開**:穩定公開 URL,供 CDN 快取、SEO、og:image;DB 可直接存 URL。

### 新模組怎麼選(建模組流程必問,dis.md #16)

**預設私有**。檔案需要 CDN 快取、SEO、對未登入者展示或社群分享 → 才選公開。私有檔案的可取範圍即該筆資料的可查範圍(資料範圍規則)。底座唯一的圖(組織商標,路徑 `org-logos/<uuid>.<ext>`:簽票時租戶可能尚未存在,歸屬由 `isOwnedUploadPath` + 寫入端權限把關;換圖會留舊檔,清理待議)只在登入後的後台顯示 → 私有。任何組織都可以掛商標;**側欄顯示「當前組織自己的商標,沒有就沿 `ancestors` 由近到遠找第一個有商標的上層」**(子組織沒設就繼承租戶的;api 算 `logoUrl` 時多一次祖先查詢,2026-09-19 定案)。bucket 命名 `cookhome-assets-<env>` / `cookhome-public-<env>`,已建於 2026-09-19(deployment.md)。

### 放棄的替代

Cloudflare R2(免流量費,但多一朵雲);DB 存 base64(文件肥大、查詢污染)。

## 交易信件(Resend)

用 **Resend**:免費 100 封/日、3000 封/月,啟用信與重設密碼信綽綽有餘,API 簡潔。

### 配置三步

1. DNS(cookhome.online)加 Resend 的 SPF + DKIM 記錄;寄件人 `no-reply@cookhome.online`
2. API key 依環境分別存 Secret Manager;dev/staging 設**收件白名單**(只寄開發者信箱)防誤寄
3. api 內做 `MailService` 介面(`sendActivationEmail`、`sendPasswordResetEmail`)— Resend 只是第一個 adapter,未來換供應商不動呼叫端

### 相關規則

- 信件模板中的品牌文字/logo 屬品牌元素,登記 `docs/branding.md`
- Token 效期與單次使用見 ADR-0009(啟用 7 天、重設 30 分鐘;`action_tokens` 存雜湊 + TTL index)
