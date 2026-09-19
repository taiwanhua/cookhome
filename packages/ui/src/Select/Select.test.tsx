import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRoot } from "react-dom/client";

import { Checkbox } from "../Checkbox/Checkbox";
import { MenuItem } from "../Menu/MenuItem";
import { Select } from "./Select";

describe("Select", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(
        <Select
          variant="standard"
          value="org-1"
          slotProps={{ input: { "aria-label": "當前組織" } }}
        >
          <MenuItem value="org-1">CookHome</MenuItem>
        </Select>,
      );
      root.unmount();
    }).not.toThrow();
  });

  /**
   * 資料範圍規則編輯器的「組織 / 使用者多選」直接用這個組合(#207 ②):
   * `multiple` + `renderValue` 決定收合時顯示什麼,選項裡放 `Checkbox` 表示勾選狀態。
   */
  it("multiple + renderValue:收合時顯示自訂摘要,選取回傳整個陣列", () => {
    const handleChange = jest.fn();
    const options = [
      { value: "org-1", label: "台北分店" },
      { value: "org-2", label: "高雄分店" },
    ];
    const selected = ["org-1"];

    render(
      <Select<string[]>
        multiple
        value={selected}
        onChange={(event) => handleChange(event.target.value)}
        renderValue={(value) => `已選 ${String(value.length)} 個組織`}
        slotProps={{ input: { "aria-label": "組織" } }}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            <Checkbox checked={selected.includes(option.value)} />
            {option.label}
          </MenuItem>
        ))}
      </Select>,
    );

    expect(screen.getByText("已選 1 個組織")).not.toBeNull();

    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "高雄分店" }));

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0]?.[0]).toEqual(["org-1", "org-2"]);
  });
});
