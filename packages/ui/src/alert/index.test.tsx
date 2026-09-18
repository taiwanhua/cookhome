import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { Alert } from ".";

describe("Alert", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(<Alert severity="error">帳號或密碼錯誤</Alert>);
      root.unmount();
    }).not.toThrow();
  });
});
