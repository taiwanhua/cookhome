import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react";

import { CheckIcon } from "./CheckIcon";
import { ChevronDownIcon } from "./ChevronDownIcon";
import { ChevronRightIcon } from "./ChevronRightIcon";
import { CloseIcon } from "./CloseIcon";
import { DotIcon } from "./DotIcon";
import { HelpIcon } from "./HelpIcon";

/** 圖示、Figma 的 viewBox(匯出 SVG 的尺寸),以及它畫了幾條 path。 */
const icons = [
  { name: "ChevronDownIcon", Icon: ChevronDownIcon },
  { name: "ChevronRightIcon", Icon: ChevronRightIcon },
  { name: "DotIcon", Icon: DotIcon },
  { name: "CloseIcon", Icon: CloseIcon },
  { name: "CheckIcon", Icon: CheckIcon },
  { name: "HelpIcon", Icon: HelpIcon },
] as const;

describe("icons", () => {
  it.each(icons)(
    "$name 畫出向量、顏色一律跟著文字色(currentColor),不帶裸色值",
    ({ Icon }) => {
      const { container } = render(<Icon fontSize="small" />);

      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      const vectors = container.querySelectorAll("path, circle");
      expect(vectors.length).toBeGreaterThan(0);
      for (const vector of vectors) {
        const paint = [
          vector.getAttribute("stroke"),
          vector.getAttribute("fill"),
        ].filter((value) => value !== null && value !== "none");
        expect(paint).not.toHaveLength(0);
        for (const value of paint) {
          expect(value).toBe("currentColor");
        }
      }
    },
  );

  it("`titleAccess` 讓圖示有無障礙名稱(沒給時是純裝飾)", () => {
    const { container, rerender } = render(<HelpIcon />);
    expect(container.querySelector("title")).toBeNull();

    rerender(<HelpIcon titleAccess="說明" />);
    expect(container.querySelector("title")?.textContent).toBe("說明");
  });
});
