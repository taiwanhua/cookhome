/* eslint-disable no-console -- 測試需要 spy console 來驗證 logger 輸出 */
import { describe, expect, it, jest } from "@jest/globals";

import { log } from "..";

jest.spyOn(globalThis.console, "log");

describe("@repo/logger", () => {
  it("prints a message", () => {
    log("hello");

    expect(console.log).toHaveBeenCalledWith("LOGGER:", "hello");
  });
});
