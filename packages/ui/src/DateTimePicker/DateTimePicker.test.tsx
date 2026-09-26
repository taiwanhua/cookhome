import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";

import { DateTimePicker } from "./DateTimePicker";

/** MUI X 的日期時間欄位是一組「區段」包在 `role="group"` 裡,值從整組的文字讀。 */
const fieldText = () => screen.getByRole("group").textContent;

describe("DateTimePicker", () => {
  it("以指定時區顯示 UTC 時點(台北 +8、東京 +9),並掛上標籤", () => {
    const { rerender } = render(
      <DateTimePicker
        label="開始時間"
        value="2026-03-01T01:30:00Z"
        timezone="Asia/Taipei"
      />,
    );

    expect(fieldText()).toContain("2026-03-01 09:30");
    expect(screen.getAllByText("開始時間").length).toBeGreaterThan(0);

    rerender(
      <DateTimePicker
        label="開始時間"
        value="2026-03-01T01:30:00Z"
        timezone="Asia/Tokyo"
      />,
    );
    expect(fieldText()).toContain("2026-03-01 10:30");
  });

  it("沒有值時輸入格顯示格式提示", () => {
    render(<DateTimePicker label="值" value={null} timezone="UTC" />);

    expect(fieldText()).toContain("YYYY-MM-DD");
  });

  it("在日曆換一天:以該時區的同一個牆上時間換算,回報 UTC ISO(秒以下捨去)", () => {
    const handleChange = jest.fn();
    render(
      <DateTimePicker
        label="值"
        value="2026-03-01T01:30:00Z"
        timezone="Asia/Taipei"
        onChange={handleChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /choose date/i }));
    fireEvent.click(screen.getByRole("gridcell", { name: "15" }));

    expect(handleChange).toHaveBeenCalled();
    expect(handleChange.mock.calls[0]?.[0]).toBe("2026-03-15T01:30:00Z");
  });

  it("minDateTime 之前的日期不可選", () => {
    render(
      <DateTimePicker
        label="值"
        value="2026-03-10T00:00:00Z"
        minDateTime="2026-03-05T00:00:00Z"
        timezone="UTC"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /choose date/i }));

    expect(
      screen.getByRole("gridcell", { name: "1" }).getAttribute("disabled"),
    ).not.toBeNull();
    expect(
      screen.getByRole("gridcell", { name: "10" }).getAttribute("disabled"),
    ).toBeNull();
  });

  it("error + helperText 會渲染成錯誤提示", () => {
    render(
      <DateTimePicker
        label="值"
        value={null}
        timezone="UTC"
        error
        helperText="請選時間"
      />,
    );

    expect(screen.getByText("請選時間")).not.toBeNull();
  });
});
