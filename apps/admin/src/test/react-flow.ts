import { afterAll, beforeAll } from "@jest/globals";

/**
 * React Flow(`@xyflow/react`)在 jsdom 要的兩個瀏覽器 API:`ResizeObserver`(量節點與畫布)、
 * `DOMMatrixReadOnly`(讀縮放)。jsdom 都沒有;沒有它們流程圖一掛就丟錯。
 * 節點的尺寸由設計器明給(`width` / `height`),所以替身只要「存在」、不必真的量。
 * 用到流程圖的頁面測試在檔案頂層呼叫一次(同 `setupFakeViewport()` 的用法)。
 */
class ResizeObserverStub {
  observe(): void {
    // jsdom 沒有版面,不回報尺寸變化
  }

  unobserve(): void {
    // 同上
  }

  disconnect(): void {
    // 同上
  }
}

class DOMMatrixReadOnlyStub {
  m22: number;

  constructor(transform?: string) {
    const scale = /scale\(([\d.]+)\)/.exec(transform ?? "")?.[1];
    this.m22 = scale === undefined ? 1 : Number(scale);
  }
}

export const setupReactFlowEnvironment = (): void => {
  const originals = {
    ResizeObserver: globalThis.ResizeObserver as unknown,
    DOMMatrixReadOnly: (globalThis as { DOMMatrixReadOnly?: unknown })
      .DOMMatrixReadOnly,
  };

  beforeAll(() => {
    Object.assign(globalThis, {
      ResizeObserver: ResizeObserverStub,
      DOMMatrixReadOnly: DOMMatrixReadOnlyStub,
    });
  });

  afterAll(() => {
    Object.assign(globalThis, originals);
  });
};
