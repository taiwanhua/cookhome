import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReact from "eslint-plugin-react";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import { config as baseConfig } from "./index.js";

/**
 * A custom ESLint configuration for libraries that use React.
 */
export const config = [
  ...baseConfig,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat["jsx-runtime"],
  pluginJsxA11y.flatConfigs.recommended,
  {
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
  },
  pluginReactHooks.configs.flat.recommended,
];

/**
 * 設計系統之牆(STYLE-05):給 apps(front/admin)用,packages/ui 不套。
 * apps 不直接 import MUI/Emotion — 一律經 @repo/ui;缺的元件先到 ui 包一層再用。
 */
export const designSystemWall = {
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@mui/*", "@emotion/*"],
            message:
              "apps 不直接 import MUI/Emotion,改從 @repo/ui 匯入;缺的元件先到 packages/ui 包一層(docs/standards/react/styling.md STYLE-05)",
          },
        ],
      },
    ],
  },
};
