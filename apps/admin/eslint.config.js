import { frontendStyle } from "@repo/eslint-config/frontend-style";
import { config } from "@repo/eslint-config/vite";

/** @type {import("eslint").Linter.Config[]} */
export default [...config, ...frontendStyle];
