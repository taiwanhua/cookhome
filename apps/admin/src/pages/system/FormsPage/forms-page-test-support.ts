import { screen } from "@testing-library/react";

import { FormVersionStatus } from "@repo/graphql";

import { authWorld } from "@/test/msw/auth-handlers";
import {
  type FormDesignWorld,
  type FormDesignWorldOptions,
  formDesignWorld,
} from "@/test/msw/form-design-handlers";
import {
  FORMS_ROUTE,
  SHOPPING_FORM_KEY,
  formFragment,
  formsModules,
  shoppingDefinition,
  versionFragment,
} from "@/test/msw/form-fixtures";
import { formRuntimeWorld } from "@/test/msw/form-runtime-handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

/**
 * 表單管理頁測試的共用場景:root(持 `system.forms.*`)、一張共用表單「購物單」,
 * 已發布 v1 + 一份以 v1 為基底的草稿(修訂 1)。
 */
export const FORMS_ALL = ["system.forms.*"];

export const defaultDesignOptions = (): FormDesignWorldOptions => ({
  forms: [formFragment()],
  versions: {
    [SHOPPING_FORM_KEY]: [
      versionFragment(shoppingDefinition(), { baseVersion: 1 }),
      versionFragment(shoppingDefinition(), {
        id: `ver-${SHOPPING_FORM_KEY}-1`,
        version: 1,
        status: FormVersionStatus.Published,
        changelog: "第一版",
        publishedAt: "2026-09-20T08:00:00.000Z",
      }),
    ],
  },
});

export const renderFormsPage = (
  options: FormDesignWorldOptions = defaultDesignOptions(),
  permissions: readonly string[] = FORMS_ALL,
): ReturnType<typeof renderApp> & { world: FormDesignWorld } => {
  const world = formDesignWorld(options);
  server.use(
    ...authWorld({
      hasRefreshCookie: true,
      modules: formsModules(permissions),
    }).handlers,
    ...world.handlers,
    // 預覽模式的帶入 / 選項會打執行端的查詢
    ...formRuntimeWorld().handlers,
  );
  return { ...renderApp({ path: FORMS_ROUTE }), world };
};

/** 等設計器載完草稿(元件面板出現)。 */
export const findDesigner = () => screen.findByRole("region", { name: "元件" });
