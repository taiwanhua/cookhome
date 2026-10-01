/**
 * 寄件人 header 的組裝(RFC 5322 的 name-addr:`顯示名 <信箱>`)。
 * 顯示名是專案提供的品牌**純文字**,Resend 會把 `from` 原樣送出、不替顯示名加引號,
 * 所以含 RFC 特殊符號的名稱要在這裡包成 quoted-string,否則 `Nova <Lab>` 會被讀成另一個信箱。
 * 這是 header 的引號規則,與信件內文的 HTML 跳脫無關。
 */

/** RFC 5322 的 specials:顯示名含其中任何一個就必須用 quoted-string。 */
const RFC_SPECIALS = /[()<>[\]:;@\\,."]/;

/** quoted-string 裡要以反斜線跳脫的兩個字元。 */
const QUOTED_PAIR_CHARS = /["\\]/g;

/** C0(含 CR、LF、TAB)、DEL、C1 控制字元的碼位範圍:這些不可進 header。 */
const isControlCode = (code: number): boolean =>
  code <= 0x1f || (code >= 0x7f && code <= 0x9f);

const hasControlChar = (text: string): boolean => {
  for (let index = 0; index < text.length; index += 1) {
    if (isControlCode(text.codePointAt(index) ?? 0)) {
      return true;
    }
  }
  return false;
};

const toQuotedString = (text: string): string => {
  const escaped = text.replaceAll(QUOTED_PAIR_CHARS, String.raw`\$&`);
  return `"${escaped}"`;
};

/**
 * 組出寄件人。不需要引號的顯示名原樣保留(既有專案的寄件人逐字不變);
 * 需要時包成 quoted-string,只跳脫雙引號與反斜線 —— 不移除、不改寫品牌名。
 * 顯示名含換行或其他控制字元時直接拒絕。寄件信箱的格式由專案設定的驗證把關。
 */
export const formatMailSender = (
  displayName: string,
  email: string,
): string => {
  if (hasControlChar(displayName)) {
    throw new Error("寄件人顯示名不可含換行或其他控制字元");
  }
  const phrase = RFC_SPECIALS.test(displayName)
    ? toQuotedString(displayName)
    : displayName;
  return `${phrase} <${email}>`;
};
