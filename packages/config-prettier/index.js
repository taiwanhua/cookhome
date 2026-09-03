import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * A shared Prettier configuration for the repository.
 *
 * @type {import("prettier").Config}
 */
const config = {
  // require.resolve 產生絕對路徑,讓 pnpm 的隔離 node_modules 下也能解析到 plugin
  plugins: [require.resolve("@trivago/prettier-plugin-sort-imports")],
  importOrder: [
    "^node:",
    "<THIRD_PARTY_MODULES>",
    "^@repo/(.*)$",
    "^@/(.*)$",
    "^[./]",
  ],
  importOrderSeparation: true,
  importOrderSideEffects: false,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
};

export default config;
