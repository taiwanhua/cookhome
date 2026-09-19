import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // `@/` = src/(與 tsconfig paths、jest moduleNameMapper 同一份約定,GEN-01)
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
