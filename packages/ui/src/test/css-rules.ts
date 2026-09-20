/**
 * 樣式斷言的共用工具。
 *
 * 為什麼不用 `getComputedStyle`:jsdom 的實作**不比對 specificity**,只照樣式表的先後
 * 順序套用最後一條相符的規則,而且對 `+` 兄弟選擇器的支援不完整 —— 開關的停用態軌道色
 * 正好寫在 `.Mui-disabled + .MuiSwitch-track` 上,在 jsdom 裡一律讀回 MUI 自己那條,
 * 元件到底有沒有補上停用色完全看不出來(#260 驗證時踩到)。
 *
 * 所以改成直接讀 emotion 產生的規則:規則是元件對瀏覽器的真實輸出,
 * 「停用時軌道換色」這個行為在這裡驗得到,也不必為了測試改元件的寫法。
 */

/** 元素身上 emotion 產生的類別(`css-…`);沒有就讓呼叫端的測試直接失敗。 */
export const emotionClassOf = (element: Element): string => {
  const found = [...element.classList].find((name) => name.startsWith("css-"));
  if (found === undefined) {
    throw new Error("這個元素沒有 emotion 產生的類別");
  }
  return found;
};

/** 整份文件裡,選擇器同時含有這幾段字串的樣式規則(依樣式表順序)。 */
export const cssRulesMatching = (
  ...needles: readonly string[]
): CSSStyleRule[] => {
  const found: CSSStyleRule[] = [];
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        needles.every((needle) => rule.selectorText.includes(needle))
      ) {
        found.push(rule);
      }
    }
  }
  return found;
};

/**
 * 符合條件的規則中,最後一條宣告了該屬性的值(同一組選擇器下,後寫的蓋前面的)。
 * 一條都沒有時回 `null` —— 對「這個狀態根本沒有自己的樣式」的斷言就是這個值。
 */
export const declaredValue = (
  rules: readonly CSSStyleRule[],
  property: string,
): string | null => {
  const values = rules
    .map((rule) => rule.style.getPropertyValue(property))
    .filter((value) => value !== "");
  return values.at(-1) ?? null;
};
