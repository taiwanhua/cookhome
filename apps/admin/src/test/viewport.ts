import { afterAll, beforeAll } from "@jest/globals";

/**
 * jsdom 不算版面,所有元素的 offsetHeight / offsetWidth 都是 0,`@repo/ui/data-table` 的虛擬捲動會以為
 * 捲動容器「看得到 0 列」而一列都不畫(做法同 `packages/ui/src/DataTable/DataTable.test.tsx`)。
 * 用到 DataTable 的頁面測試在檔案頂層呼叫一次,測試期間給固定的視窗大小。
 */
const VIEWPORT = { offsetHeight: 600, offsetWidth: 1200 } as const;

export const useFakeViewport = (): void => {
  const originals = Object.fromEntries(
    Object.keys(VIEWPORT).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, key),
    ]),
  );

  beforeAll(() => {
    for (const [key, value] of Object.entries(VIEWPORT)) {
      Object.defineProperty(HTMLElement.prototype, key, {
        configurable: true,
        get: () => value,
      });
    }
  });

  afterAll(() => {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor !== undefined) {
        Object.defineProperty(HTMLElement.prototype, key, descriptor);
      }
    }
  });
};
