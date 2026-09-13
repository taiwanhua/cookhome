// migrate-mongo 設定(正本:ADR-0002)
// 連現有環境資料庫:URI 一律走 MONGODB_URI 環境變數,需含資料庫名稱
// (例:mongodb://127.0.0.1:27017/cookhome),不新開資料庫。

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "缺少 MONGODB_URI 環境變數(需含資料庫名稱,例:mongodb://127.0.0.1:27017/cookhome)",
  );
}

const config = {
  mongodb: {
    url: uri,
  },

  // 遷移檔目錄;檔名規約 <時間戳>_<類別>_<描述>(見 src/migration-filename.ts)
  migrationsDir: "migrations",

  // migrate-mongo 自建的 collection,記錄哪些遷移跑過(防重跑)
  changelogCollectionName: "changelog",

  lockCollectionName: "changelog_lock",
  lockTtl: 0,

  migrationFileExtension: ".js",

  // 遷移一次性:變更寫新檔不改舊檔,故不需 file hash 比對
  useFileHash: false,

  moduleSystem: "esm",
};

export default config;
