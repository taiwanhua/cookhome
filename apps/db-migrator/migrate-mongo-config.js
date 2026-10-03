// migrate-mongo 設定(正本:ADR-0002)
// 連現有環境資料庫:URI 一律走 MONGODB_URI 環境變數,需含資料庫名稱
// (例:mongodb://127.0.0.1:27017/wowgo-base),不新開資料庫。

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "缺少 MONGODB_URI 環境變數(需含資料庫名稱,例:mongodb://127.0.0.1:27017/wowgo-base)",
  );
}

const config = {
  mongodb: {
    url: uri,
  },

  // 遷移檔目錄;檔名規約 <時間戳>_<類別>_<描述>(見 src/migration-filename.ts)。
  // 根目錄只有已發布的歷史檔;update(src/update/migrate-adapter.ts)沿用本設定,但每次把這一項換成
  // 只含單支 migration 的暫存目錄,所以 base/ 與 project/ 的新 migration 也由同一份設定執行。
  migrationsDir: "migrations",

  // migrate-mongo 自建的 collection,記錄哪些遷移跑過(防重跑)
  changelogCollectionName: "changelog",

  // 套件自己的鎖維持停用(lockTtl: 0 時它完全不碰這張表)。整批互斥由 update 在同一張表的固定 _id 文件負責;
  // 啟用套件的鎖會在結束時清空整張表,連那一筆一起刪掉 —— 不要改成非 0。
  lockCollectionName: "changelog_lock",
  lockTtl: 0,

  migrationFileExtension: ".js",

  // 遷移一次性:變更寫新檔不改舊檔,故不需 file hash 比對
  useFileHash: false,

  moduleSystem: "esm",
};

export default config;
