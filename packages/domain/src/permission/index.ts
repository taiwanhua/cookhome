/**
 * `@repo/domain/permission` 的出口檔(bunchee 由 `exports` 名反推本檔;GEN-01 的 packages 邊界例外)。
 *
 * - `keys.ts`:權限 key 的切分、組合與「持有」判斷(ADR-0004、ADR-0011「key 切分共識」)
 * - `matrix.ts`:權限矩陣的勾選連動、`*` 收斂 / 展開、防越權、整組切換(ADR-0004、role-manager.md)
 */
export * from "./keys";
export * from "./matrix";
