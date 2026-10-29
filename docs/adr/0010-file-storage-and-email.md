# 檔案儲存用 GCS 簽名網址直傳;交易信件用 Resend + 介面抽象

> 現況說明見 `docs/concepts/storage-and-mail.md`。

## 檔案儲存(GCS)

### 架構:兩個 bucket

**決策**:

- `GCS_BUCKET_PRIVATE` 指定的專案 bucket:私有(預設),uniform bucket-level access。
- `GCS_BUCKET_PUBLIC` 指定的專案 bucket:公開讀。
- `StorageService` 以**用途(`purpose`)**決定路徑前綴、bucket 與簽發前要驗的權限;visibility 是用途的衍生屬性,不另給參數。新模組要存檔只登記一個 purpose,不碰基建。

**理由**:私有是安全的預設;空的公開 bucket 零成本,先建著。讓用途決定一切,呼叫端就不會傳錯 bucket。

### 上傳

**決策**:前端向 API 要 V4 上傳簽名網址(API 先驗權限、檔型、大小;10 分鐘效期)→ 瀏覽器直傳 GCS → API 寫回物件路徑。檔案不經過 API server。

- 物件名 `<前綴>/<uuid>.<副檔名>`;前綴不放 orgId / userId。
- 檔型與大小上限**依用途**,不是全站一套。
- 前綴是歸屬檢查的依據:`isOwnedUploadPath` 靠前綴 + 該前綴的副檔名白名單判斷「是不是本 API 簽的路徑」。白名單依前綴取聯集,不取全站聯集。
- 兩個用途共用前綴時,副檔名互相放寬;**要共用前綴就要講得出「塞錯欄位也不會外洩」**,講不出就各給一個前綴。

**理由**:

- 直傳省 API 頻寬與記憶體。
- 簽票時資料可能還不存在(開通租戶的商標在租戶建立前上傳),所以路徑不能帶組織;歸屬改由寫入端權限與路徑檢查把關。
- 取全站聯集會讓放寬附件連帶放寬商標(`org-logos/<uuid>.zip` 通過)。

### 孤兒物件

**決策**:「上傳了但沒送出」的物件是已接受的殘留。不做孤兒掃描、不做 TTL 清理、不在簽票時先寫「待確認」記錄。有主的物件被換掉時照樣刪(換圖即刪舊),刪不掉只記 log、不擋更新。

**理由**:這類物件沒有任何欄位指向它,API 也不知道它存在;掃描要維護「哪些路徑有主」的反向索引,成本遠大於儲存費。真要清,在 bucket 設 lifecycle rule(前綴 + 年齡),不在 API 寫掃描器。

### 讀取

**決策**:

- **私有**:API 先驗「這個人查得到這筆資料嗎」(經 BaseRepository,含資料範圍規則),再簽發短效讀取網址。DB 存物件路徑,不存 URL。
- **公開**:穩定公開 URL,供 CDN 快取、SEO、og:image;DB 同樣存物件路徑,讀取時組出 URL。
- 側欄商標:當前組織自己的,沒有就沿 `ancestors` 由近到遠找第一個有商標的上層。

**理由**:簽名網址會過期,看時現簽;私有檔的可取範圍 = 該筆資料的可查範圍,不另立一套權限。

### 新模組怎麼選

建模組流程必問這一題(`/module-scaffold` skill 的需求問答「上傳欄」;步驟見 `docs/agents/module-scaffold.md`)。

**預設私有**。需要 CDN 快取、SEO、對未登入者展示或社群分享才選公開。

### 放棄的替代

- Cloudflare R2:免流量費,但多一朵雲。
- DB 存 base64:文件肥大、查詢污染。

## 交易信件(Resend)

**決策**:

- 用 Resend,寄件人由 `packages/project-config/src/project/mail.ts` 指定;啟用前在專案寄件網域驗證 SPF + DKIM。
- API key 依環境存 Secret Manager。
- `MailService` 支援收件白名單(`MAIL_ALLOWLIST`,有值時只寄名單內信箱),空值表示不限收件人;名單外的信靜默略過、不視為錯誤,留作本機或臨時防誤寄用。
- api 內做 `MailService` 介面,Resend 只是第一個 adapter。
- 信件模板的品牌文字 / logo 登記 `docs/branding.md`。

**理由**:交易信件需求集中在啟用、重設密碼與通知,API 簡潔;介面抽象讓換供應商不動呼叫端。

## 影響

- Token 效期與單次使用見 ADR-0009。
- 劇本 E2E 以 `GCS_API_ENDPOINT` 指向 fake GCS;雲端環境不設。
