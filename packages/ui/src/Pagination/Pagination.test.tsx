import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";

import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("渲染頁碼,並把目前頁標記為 current", () => {
    render(<Pagination count={3} page={2} />);

    const currentPage = screen.getByLabelText("第 2 頁,目前頁");

    expect(currentPage.getAttribute("aria-current")).toBe("page");
  });

  it("點其他頁碼時回報新的頁數", () => {
    const handleChange = jest.fn();
    render(<Pagination count={3} page={1} onChange={handleChange} />);

    fireEvent.click(screen.getByLabelText("前往第 3 頁"));

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0]?.[1]).toBe(3);
  });
});
