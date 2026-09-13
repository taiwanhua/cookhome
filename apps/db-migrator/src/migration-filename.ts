/**
 * 遷移檔命名規約(正本:ADR-0002):
 *
 *   <時間戳>_<類別>_<描述>.js
 *
 * - 時間戳:14 位數字(YYYYMMDDHHmmss),決定執行順序
 * - 類別:schema(索引/結構)| data(回填/轉換)| cleanup(清理)
 * - 描述:kebab-case(小寫英數,連字號分隔)
 */
export const MIGRATION_FILENAME_PATTERN =
  /^\d{14}_(?:schema|data|cleanup)_[a-z0-9]+(?:-[a-z0-9]+)*\.js$/;

export function isValidMigrationFilename(fileName: string): boolean {
  return MIGRATION_FILENAME_PATTERN.test(fileName);
}
