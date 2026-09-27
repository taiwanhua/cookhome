import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import { useBreakpointDown } from "./useMediaQuery";

const Probe = () => <span>{useBreakpointDown("sm") ? "手機" : "桌機"}</span>;

/** 以 `matchMedia` 替身模擬視窗寬度:`max-width` 查詢在寬度小於它時成立。 */
const setViewportWidth = (width: number) => {
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const maxWidth = /max-width:\s*([\d.]+)px/u.exec(query)?.[1];
      return {
        matches: maxWidth !== undefined && width <= Number(maxWidth),
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: () => false,
      };
    },
  });
};

describe("useBreakpointDown", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "matchMedia");
  });

  it("視窗比斷點窄 → true", () => {
    setViewportWidth(375);
    render(<Probe />);
    expect(screen.getByText("手機")).toBeInTheDocument();
  });

  it("視窗比斷點寬 → false", () => {
    setViewportWidth(1280);
    render(<Probe />);
    expect(screen.getByText("桌機")).toBeInTheDocument();
  });

  it("沒有 matchMedia → false(桌機版面)", () => {
    render(<Probe />);
    expect(screen.getByText("桌機")).toBeInTheDocument();
  });
});
