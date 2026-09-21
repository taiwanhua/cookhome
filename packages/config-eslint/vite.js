import pluginReactRefresh from "eslint-plugin-react-refresh";
import { defineConfig } from "eslint/config";

import { designSystemWall, config as reactConfig } from "./react.js";

/**
 * A custom ESLint configuration for React apps built with Vite.
 */
export const config = defineConfig(
  reactConfig,
  {
    plugins: {
      "react-refresh": pluginReactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  designSystemWall,
);
