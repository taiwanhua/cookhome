import { config } from "@repo/eslint-config";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    rules: {
      /*
       * e2e 不由 turbo 跑(`pnpm e2e` 直接叫 playwright),它讀的環境變數也就不該登記進
       * 根 turbo.json 的 globalEnv —— 那會讓每個 package 的快取雜湊都跟著 CI / E2E_* 變動。
       * 到期條件:哪天 e2e 變成一個 turbo task 時拿掉這條,改為在該 task 宣告 `env`。
       */
      "turbo/no-undeclared-env-vars": "off",
    },
  },
];
