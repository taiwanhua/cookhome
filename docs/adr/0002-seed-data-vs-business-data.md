# 種子資料以 key 冪等 seed;業務資料只整庫快照;禁止局部合併

> 現況說明見 `docs/concepts/data-layer-and-isolation.md`「種子資料與遷移」。

## 決策

- 資料分兩類:
  - **種子資料**(模組、權限、種子角色、欄位管理、資料目標):程式碼定義,以穩定 kebab-case `key` 在各環境冪等 upsert;id 各環境各自生成。
  - **業務資料**(帳號、食譜等):不跨環境搬移。重現正式環境問題用整庫 dump / restore,還原後補跑 seed。
- 任何「把部分資料塞進已有資料的環境」的局部合併都禁止。
- 種子記錄以 `isSystem` 保護:不可刪、不可改 key,只有 seed 能維護。
- **seed 以 key 認養人建的同一筆**:同一類資料允許人在畫面建(`isSystem: false`,如 root 在欄位管理新增的類別)時,seed 宣告同一個 key 就把那一筆轉成種子 —— `isSystem` 改 true、宣告的欄位以 seed 為準、`_id` 不動(引用它的資料照舊)。識別鍵不是人建時就有的(如欄位選項的 `<類別 key>.<value>`)由宣告指定「怎麼找人建的同一筆」(`adoptBy`)。認養單向;沒宣告的人建資料 seed 一律不碰。摘要印「新增 / 更新 / 認養 / 未變」四種計數;認養計數對所有 seed 集合都適用(任何集合以 key 對到 `isSystem` 不是 true 的文件都算認養)。
- 執行手段是獨立的 `apps/db-migrator`:migrate-mongo 管一次性遷移,薄 runner 管冪等種子。不部署、不常駐、不新開資料庫。
- 部署 api 成功後依序跑 `migrate` → `seed`。build 不碰 DB;server 啟動時不跑。
- 種子欄位分兩種:**每次都 seed**(預設)與**初始 seed 值**(欄位存在就不覆寫,只補從未寫過的欄位)。
- seed 不分環境,三環境跑同一份宣告。
- seed 以原生 mongodb driver 手寫文件形狀,不 import api 的 schema。
- key 對 production 跑過 seed 就不再改;改 key = 新種一筆,要配 cleanup migration。
- root 初始帳號從環境變數建立,只在不存在時建。

## 理由

- 跨環境 id 對不上的災難只來自局部合併;把資料分兩類,id 就不必一致。
- 初始 seed 值的欄位(如 `enabled`)是給人操作的開關,seed 不該每次翻回去;只補「從未寫過的欄位」,後來才加進宣告的初值欄位才落得了地。
- 認養而不是另建一筆:人建的那一筆可能已被表單定義或業務資料引用,另建會讓同一個 key 出現兩筆、引用對到舊的;`_id` 不動,引用就不必搬。
- 不在 server 啟動時跑:Cloud Run 冷啟要快,也避免多實例併發寫。
- seed 不 import api:STRUCT-01 禁 app 互相 import,且 BaseRepository 對沒有操作者上下文的查詢一律拋錯。
- root 帳號只建不改:部署不能重設密碼。

## 取捨

- 欄位形狀存在兩處(api schema 與 seed),schema 改了 seed 要跟;索引測試抓不到欄位漂移。漂移變嚴重再抽共用型別套件(待辦見 `docs/tmp/dis.md` 搜「db-schemas」)。
- migrations 維持 `.js`(migrate-mongo 的載入器);seed 以 tsx 直跑 TypeScript。
- 示範家族在 production 要關閉,靠人在「模組與權限」頁停用,不靠環境變數。

## 還原(reset)

- `apps/db-migrator` 的第三支指令,驗收重測用,**只給 dev / staging**。
- 兩種模式:`full`(drop → migrate → seed,人調過的初始值一併回到宣告值)與 `data`(只刪人建的資料再 seed,人調過的初始值保留)。
- `data` 模式「seed 管 / 人建」的判準只有一個來源:registry 宣告的識別鍵。不看 `isSystem`,也不寫死 collection 清單;不在 registry 的 collection 整表清空。例:root 在畫面建的欄位類別,key 不在宣告清單裡就算人建的、一起刪;key 已宣告的那一筆留著,由同一次執行的 seed 認養。
- production 永遠拒絕,沒有旗標能打開。

**理由**:驗收要能回到乾淨狀態重測;判準只看 registry,日後新增的業務表自動被清,不必回頭改 reset;`data` 模式能保留人調的開關,正是「初始 seed 值」機制的直接結果,seed 端不必為 reset 做任何事。

## 影響

- 新增設定類資料 = 加宣告檔 + 登記 registry。
- 改種子欄位的形狀要同步 seed 宣告。
- reset 的用法與 workflow 見 `docs/deployment.md`「資料庫還原(reset)」。
