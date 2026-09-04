import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import Root from "./app/root";

import "./index.css";

const el = document.querySelector("#root");
if (el) {
  const root = createRoot(el);
  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
} else {
  throw new Error("Could not find root element");
}
