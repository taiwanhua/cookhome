# 檔案儲存用 GCS 簽名網址直傳;交易信件用 Resend + 介面抽象

## 檔案儲存(GCS)

### 架構:兩個 bucket,實作底座時一次配好

- `cookhome-assets-{dev|staging|prod}`:**私有**(預設),uniform bucket-level access、不開公開讀
- `cookhome-public-{dev|staging|prod}`:**公開讀**(空 bucket 零成本,先建著)
- `StorageService` 介面以 **`purpose`**(用途,如 `ORG_LOGO`)決定路徑前綴、bucket 與簽發前要驗的權限;visibility 是用途的衍生屬性,不另給參數(2026-09-19 實作定案,#137)。新模組要存檔只登記一個 purpose,不再碰基建

### 上傳(私有/公開共用同一條路)

前端向 API 要 **V4 上傳簽名網址**(API 先驗:該 purpose 對應的操作者權限、檔型、大小;網址效期 10 分鐘,程式常數)→ 瀏覽器**直傳 GCS** → API 寫回物件路徑。檔案不經過 API server。

**路徑前綴由 purpose 決定,宣告在一張表上;預設一 purpose 一前綴**(2026-09-23 明寫,#318;正本 `apps/api/src/storage/upload-rules.ts` 的 `UPLOAD_PATH_PREFIXES`)。物件名一律 `<前綴>/<uuid>.<副檔名>`,新增用途時在 `UPLOAD_VISIBILITIES`(公開 / 私有)、`UPLOAD_PATH_PREFIXES`、`UPLOAD_RULES`(檔型 → 副檔名、大小上限)**各補一行**,三張表的 key 是同一組 `UploadPurpose`。

**前綴不只是命名慣例,它是歸屬檢查的依據**:`isOwnedUploadPath(path)` 靠前綴反推「這是不是本 API 簽出來的路徑」,再拿**該前綴的副檔名白名單**比對。所以:

- **白名單依前綴取聯集,不取全站聯集**(#344):放寬附件的副檔名不可以連帶讓 `org-logos/<uuid>.zip` 通過。
- **兩個 purpose 共用同一個前綴時,兩邊的副檔名互相放寬** —— 現況 `DEMO_COVER` 與 `DEMO_ATTACHMENT` 都用 `demo`(#318 票上指定),所以那個前綴底下圖片與文件的副檔名都合法。**這是可接受的**:兩者落在不同 bucket,把附件的路徑塞進封面欄位只會指到一個不存在的物件(不會外洩)。**要共用前綴就要能講出這句話**;講不出來就各給一個前綴。
- **前綴裡不放 orgId / userId**(簽票時組織可能還不存在),歸屬由寫入端的權限與 `isOwnedUploadPath` 把關。

**「上傳了但沒送出」的孤兒物件是已接受的殘留**(2026-09-23 明寫,#161):使用者選了檔、瀏覽器已直傳 GCS,然後關掉彈窗不送出 —— 那個物件沒有任何 DB 欄位指向它,而 API 從頭到尾沒參與上傳,**根本不知道它存在**。我們**不做**孤兒掃描、不做 TTL 清理,也不為此在簽票時先寫一筆「待確認」記錄:

- 代價是少量永遠不會被讀到的物件,GCS 的儲存費用可以忽略;要做掃描就得維護「哪些路徑有主」的反向索引,成本遠大於收益。
- **有主的物件被換掉時照樣刪**(「換圖即刪舊」,見下方「新模組怎麼選」):那是 API 知道的狀態轉換,刪得掉;刪不掉只記 log、不擋更新。
- 開通租戶失敗時的**補償刪除也只抹自己建的東西**(`docs/modules/org-manager.md`「開通的回滾是補償刪除」),同樣不去掃孤兒。
- 這條之後要翻案,正確的作法是在 bucket 上設 lifecycle rule(依前綴 + 年齡),而不是在 API 裡寫掃描器。

**檔型與大小上限依 purpose**(2026-09-22 / #344 起;在那之前全站一套 PNG/JPG/WebP + 2MB):圖片類用途(`ORG_LOGO`、`DEMO_COVER`)維持 PNG/JPG/WebP、≤2MB;附件類用途(`DEMO_ATTACHMENT`)另收 pdf / doc / docx / xls / xlsx / zip,≤20MB。白名單與上限的正本是 `apps/api/src/storage/upload-rules.ts` 的 `UPLOAD_RULES`,新用途在那裡登記一列即可。**放寬只放寬該用途**:`isOwnedUploadPath` 依路徑前綴各自比對自己的副檔名白名單,`org-logos/<uuid>.zip` 仍然不算本 API 簽出來的路徑。

### 讀取(私有與公開唯一的分岔)

- **私有**:前端經 API 取檔 — API 驗權(接資料隔離與資料範圍規則:BaseRepository 查得到該筆資料的人才可取檔)後,簽發**短效讀取簽名網址**(商標類 TTL 1 小時 = `GCS_SIGNED_URL_TTL` 預設、前端快取;敏感檔約 15 分鐘);極敏感檔案可收緊為 API 代理串流。**DB 存物件路徑(bucket+key),不存 URL**(簽名網址會過期,看時現簽)。
- **公開**:穩定公開 URL,供 CDN 快取、SEO、og:image;DB 可直接存 URL。
- **測試用的端點覆寫**(#402):`GCS_API_ENDPOINT` 只在劇本 E2E 設,api 改以測試用假憑證簽 V4 網址、連同公開 URL 一起指向 fake GCS 容器(`apps/e2e/docker-compose.yml`);任何雲端環境都不設,上面兩條路徑照舊走 ADC 與真 GCS。

### 新模組怎麼選(建模組流程必問,dis.md #16)

**預設私有**。檔案需要 CDN 快取、SEO、對未登入者展示或社群分享 → 才選公開。私有檔案的可取範圍即該筆資料的可查範圍(資料範圍規則)。底座唯一的圖(組織商標,路徑 `org-logos/<uuid>.<ext>`:簽票時租戶可能尚未存在,歸屬由 `isOwnedUploadPath` + 寫入端權限把關;**換圖即刪舊** — `updateOrg` 把 `logoPath` 換成新值或清空時,更新成功後就刪掉舊物件,刪不掉只記 log、不擋更新,歷史遺留的孤兒物件不另做掃描,2026-09-22 定案 #161)只在登入後的後台顯示 → 私有。任何組織都可以掛商標;**側欄顯示「當前組織自己的商標,沒有就沿 `ancestors` 由近到遠找第一個有商標的上層」**(子組織沒設就繼承租戶的;api 算 `logoUrl` 時多一次祖先查詢,2026-09-19 定案)。bucket 命名 `cookhome-assets-<env>` / `cookhome-public-<env>`,已建於 2026-09-19(deployment.md)。

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
