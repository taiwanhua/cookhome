import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app";

import "./index.css";

const queryClient = new QueryClient();

const el = document.querySelector("#root");
if (el) {
  const root = createRoot(el);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
} else {
  throw new Error("Could not find root element");
}
