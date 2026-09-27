/**
 * `@repo/domain/form-keys` 的出口檔(bunchee 由 `exports` 名反推本檔;GEN-01 的 packages 邊界例外)。
 *
 * 表單 key、欄位 key、租戶短碼的格式規則(`form/keys.ts` 的輕量出口)。`@repo/domain/form` 打成一檔、
 * 模組頂層就註冊 JSONLogic 運算子並帶進 decimal,只要格式檢查的地方(組織管理的租戶短碼、
 * 建表單的 key)改走這裡,才不會把整個表單引擎拉進首屏 bundle。
 */
export * from "../form/keys";
