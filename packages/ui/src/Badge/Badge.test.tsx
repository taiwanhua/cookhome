import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import { Badge } from "./Badge";

const badgeOf = (container: HTMLElement): Element => {
  // MUI 的徽章沒有 role,只能用 class 取
  const badge = container.querySelector(".MuiBadge-badge");
  if (badge === null) {
    throw new Error("測試找不到徽章");
  }
  return badge;
};

describe("Badge", () => {
  it("顯示數字", () => {
    render(<Badge badgeContent={3} color="primary" />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("超過上限顯示 99+(預設上限 99)", () => {
    render(<Badge badgeContent={120} />);

    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("0 預設不顯示;showZero 才顯示", () => {
    const { container, rerender } = render(<Badge badgeContent={0} />);

    expect(badgeOf(container)).toHaveClass("MuiBadge-invisible");

    rerender(<Badge badgeContent={0} showZero />);

    expect(badgeOf(container)).not.toHaveClass("MuiBadge-invisible");
  });

  it("invisible 隱藏", () => {
    const { container } = render(<Badge badgeContent={5} invisible />);

    expect(badgeOf(container)).toHaveClass("MuiBadge-invisible");
  });

  it("dot 只顯示圓點、不顯示數字", () => {
    const { container } = render(<Badge badgeContent={5} variant="dot" />);

    expect(badgeOf(container)).toHaveClass("MuiBadge-dot");
    expect(screen.queryByText("5")).not.toBeInTheDocument();
  });

  it("有 children 時疊在它上面", () => {
    render(
      <Badge badgeContent={2} color="error">
        <span>收件匣</span>
      </Badge>,
    );

    expect(screen.getByText("收件匣")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
