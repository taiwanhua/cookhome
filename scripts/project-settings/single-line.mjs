/**
 * CLI 寫 stderr 前的最後一道:把控制字元與 Unicode 的行 / 段落分隔符換成 `?`,保證輸出是單行。
 * 錯誤訊息本來就只該用固定文字;這裡防的是漏網的輸入原值夾帶換行或 `::warning::` 這類 workflow 指令。
 */
const UNSAFE = /[\p{Cc}\p{Zl}\p{Zp}]/gu;

export function singleLine(message) {
  return String(message).replaceAll(UNSAFE, "?");
}
