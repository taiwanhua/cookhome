/**
 * ui 元件測試的最小掛載器:用 `createRoot` + React 的 `act` 做渲染與互動,
 * 不引入 testing-library(@repo/ui 刻意維持零測試相依,只靠 jsdom)。
 * Dialog / Popover 這類走 portal 的元件,斷言對象是 `document.body` 不是 container。
 */
import { type ReactNode, act } from "react";
import { createRoot } from "react-dom/client";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export interface MountedTree {
  container: HTMLElement;
  unmount: () => void;
}

/** 掛載到一個接在 document.body 上的容器(portal 才有正確的父層)。 */
export const mount = (node: ReactNode): MountedTree => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

/** 在 act 內點擊,讓狀態更新在斷言前跑完(SVG 沒有 `click()`,改發事件)。 */
export const clickElement = (element: Element): void => {
  act(() => {
    if (element instanceof HTMLElement) {
      element.click();
    } else {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    }
  });
};

/** 找不到就丟錯,省掉測試裡的 non-null 斷言(strictTypeChecked 禁用 `!`)。 */
export const requireElement = (root: ParentNode, selector: string): Element => {
  const element = root.querySelector(selector);
  if (element === null) {
    throw new Error(`測試找不到元素:${selector}`);
  }
  return element;
};

/** `requireElement` 的 input 版:互動測試常要讀 `checked` / `value`。 */
export const requireInput = (
  root: ParentNode,
  selector = "input",
): HTMLInputElement => {
  const element = root.querySelector<HTMLInputElement>(selector);
  if (element === null) {
    throw new Error(`測試找不到 input:${selector}`);
  }
  return element;
};
