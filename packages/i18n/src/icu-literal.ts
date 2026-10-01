/** ICU 訊息裡會開啟語法的字元:`{` 開參數,`<` 開標籤。 */
const SYNTAX_OPENER = /[<{]/;

/**
 * 把純文字編成「顯示出來就是原文」的 ICU 訊息。字典是 ICU 訊息,專案提供的品牌名、
 * metadata 卻是純文字:不編碼的話 `{name}` 會被當參數、`<x>` 被當標籤、`'{` 被當引號。
 *
 * 做法:單引號一律寫成 `''`;從第一個 `{` 或 `<` 起,把整段尾巴包進**一組**引號。
 * 不逐字元各包一組 —— 相鄰的兩組引號(`'{''}'`)中間的 `''` 會被讀成一個單引號。
 * 沒有這三種字元的文字原樣回傳(`%s`、`}`、`>`、`#` 在最外層本來就是文字)。
 */
export const encodeIcuLiteral = (text: string): string => {
  const escaped = text.replaceAll("'", "''");
  const firstSyntax = escaped.search(SYNTAX_OPENER);
  return firstSyntax === -1
    ? escaped
    : `${escaped.slice(0, firstSyntax)}'${escaped.slice(firstSyntax)}'`;
};
