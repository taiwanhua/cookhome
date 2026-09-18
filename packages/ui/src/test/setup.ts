import "@testing-library/jest-dom/jest-globals";

import { afterEach } from "@jest/globals";
import { cleanup } from "@testing-library/react";

// 元件測試共用的收尾:每個案例後拆掉掛載的 DOM(portal 的 Dialog / Popover 也一併清掉)
afterEach(() => {
  cleanup();
});
