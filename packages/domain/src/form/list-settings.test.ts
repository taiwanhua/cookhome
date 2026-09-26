import { describe, expect, it } from "@jest/globals";

import { listBuiltinColumnsOf } from "./list-settings";

describe("列表內建欄開關", () => {
  it("沒存過或不是 boolean 的鍵 = 顯示;存了 false 就關", () => {
    expect(listBuiltinColumnsOf(null)).toEqual({
      form: true,
      status: true,
      createdBy: true,
    });
    expect(listBuiltinColumnsOf({ form: false, status: "no" })).toEqual({
      form: false,
      status: true,
      createdBy: true,
    });
  });
});
