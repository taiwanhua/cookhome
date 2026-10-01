/**
 * 目前套用的主題主色(測試用)。主題以 CSS 變數輸出(`--mui-palette-primary-main`),
 * jsdom 不解析 `var()`,所以直接從 emotion 插進去的樣式規則讀宣告值。
 */
export const primaryMainOf = (root: Document): string | null => {
  const css = [...root.styleSheets]
    .flatMap((sheet) => [...sheet.cssRules])
    .map((rule) => rule.cssText)
    .join("\n");
  return (
    /--mui-palette-primary-main:\s*(#[0-9A-Fa-f]{6})/.exec(css)?.[1] ?? null
  );
};
