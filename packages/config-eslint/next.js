import pluginNext from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";

import { designSystemWall, config as reactConfig } from "./react.js";

/**
 * A custom ESLint configuration for libraries that use Next.js.
 */
export const config = defineConfig(
  reactConfig,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  pluginNext.configs["core-web-vitals"],
  designSystemWall,
);
