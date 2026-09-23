import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";

import { SelectField } from "./SelectField";

const branches = [
  { value: "org-1", label: "台北分店" },
  { value: "org-2", label: "高雄分店" },
] as const;

describe("SelectField", () => {
  it("標籤就是 combobox 的名稱;選另一個選項回報它的 value", () => {
    const handleChange = jest.fn();
    render(
      <SelectField
        label="分店"
        value="org-1"
        options={branches}
        onChange={handleChange}
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "分店" });
    expect(combobox.textContent).toBe("台北分店");

    fireEvent.mouseDown(combobox);
    fireEvent.click(screen.getByRole("option", { name: "高雄分店" }));

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0]?.[0]).toBe("org-2");
  });

  it("helperText 顯示在欄位下方;error 時 combobox 標 aria-invalid", () => {
    render(
      <SelectField
        label="分店"
        value="org-1"
        options={branches}
        helperText="必須選一間"
        error
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText("必須選一間")).not.toBeNull();
    expect(
      screen
        .getByRole("combobox", { name: "分店" })
        .getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("displayEmpty + 空值項:值為空時顯示空值文字,選回空值項回報空字串", () => {
    const handleChange = jest.fn();
    render(
      <SelectField
        label="擁有者"
        value="org-1"
        displayEmpty
        options={[{ value: "", label: "未指定" }, ...branches]}
        onChange={handleChange}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "擁有者" }));
    fireEvent.click(screen.getByRole("option", { name: "未指定" }));

    expect(handleChange.mock.calls[0]?.[0]).toBe("");
  });

  it("displayEmpty:值為空字串時顯示空值項的文字", () => {
    render(
      <SelectField
        label="擁有者"
        value=""
        displayEmpty
        options={[{ value: "", label: "未指定" }, ...branches]}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "擁有者" }).textContent).toBe(
      "未指定",
    );
  });

  it("停用的選項點了不回報", () => {
    const handleChange = jest.fn();
    render(
      <SelectField
        label="分店"
        value="org-1"
        options={[branches[0], { ...branches[1], disabled: true }]}
        onChange={handleChange}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "分店" }));
    const disabledOption = screen.getByRole("option", { name: "高雄分店" });
    expect(disabledOption.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(disabledOption);

    expect(handleChange).not.toHaveBeenCalled();
  });

  it("disabled 時標記為停用,點了也不會展開選單", () => {
    render(
      <SelectField
        label="分店"
        value="org-1"
        options={branches}
        disabled
        onChange={jest.fn()}
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "分店" });
    expect(combobox.getAttribute("aria-disabled")).toBe("true");

    fireEvent.mouseDown(combobox);

    expect(screen.queryByRole("option")).toBeNull();
  });

  it("multiple:收合時預設串起選到的文字,勾選回傳依點選先後排列的陣列", () => {
    const handleChange = jest.fn();
    render(
      <SelectField
        multiple
        label="分店"
        value={["org-2"]}
        options={branches}
        onChange={handleChange}
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "分店" });
    expect(combobox.textContent).toBe("高雄分店");

    fireEvent.mouseDown(combobox);
    const listbox = screen.getByRole("listbox");
    expect(
      listbox.querySelectorAll('input[type="checkbox"]:checked'),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: "台北分店" }));

    expect(handleChange.mock.calls[0]?.[0]).toEqual(["org-2", "org-1"]);
  });

  it("multiple + renderValue:收合時顯示自訂摘要", () => {
    render(
      <SelectField
        multiple
        label="分店"
        value={["org-1", "org-2"]}
        options={branches}
        renderValue={(value) => `已選 ${String(value.length)} 間`}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "分店" }).textContent).toBe(
      "已選 2 間",
    );
  });
});
