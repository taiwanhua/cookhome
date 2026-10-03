/** 連線字串的環境變數;沒有預設值 —— 連到哪個資料庫一律由啟動它的環境明確給定。 */
export const MONGODB_URI_ENV = "MONGODB_URI";

/**
 * api HTTP 服務與受管定義 CLI 共用的連線字串檢查:缺值、空字串、純空白都拒絕,
 * 不落到任何內建的本機資料庫。錯誤只指名變數,不帶輸入值(連線字串含帳密);
 * 合法的非空字串原樣交給 driver,不修剪也不改寫。
 *
 * 在 Nest 的連線 factory 裡呼叫(不在 module import 時讀環境):schema CLI 與測試 harness
 * 都是先設好環境變數才啟動組裝。
 */
export function requireMongoDbUri(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `缺少 ${MONGODB_URI_ENV} 環境變數(MongoDB 連線字串;沒有預設值,本地見 .env.example)`,
    );
  }
  return value;
}
