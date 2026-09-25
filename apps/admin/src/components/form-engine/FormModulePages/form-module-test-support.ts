import { authWorld } from "@/test/msw/auth-handlers";
import {
  SHOPPING_FORM_KEY,
  SHOPPING_LIST_KEY,
  shoppingDefinition,
  shoppingListModules,
} from "@/test/msw/form-fixtures";
import {
  type FormRuntimeWorld,
  type FormRuntimeWorldOptions,
  formRuntimeWorld,
} from "@/test/msw/form-runtime-handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

/**
 * 表單模組預設組裝(購物清單)測試的共用場景(TEST-08:一份形狀,測試檔只寫行為)。
 * 兩個旋鈕:持有哪些權限(`permissions`,掛在購物清單那一層)、假 api 的狀態(`world`)。
 */
export const SHOPPING_ALL = [`${SHOPPING_LIST_KEY}.*`];

export const shoppingForm = {
  key: SHOPPING_FORM_KEY,
  name: "購物單",
  moduleKey: SHOPPING_LIST_KEY,
  currentVersion: 1,
  tabLabelTemplate: null,
};

export const defaultRuntimeOptions = (): FormRuntimeWorldOptions => ({
  moduleForms: [shoppingForm],
  versions: { [`${SHOPPING_FORM_KEY}@1`]: shoppingDefinition() },
});

export interface ShoppingSetup {
  path: string;
  permissions?: readonly string[];
  world?: FormRuntimeWorldOptions;
}

export const renderShopping = ({
  path,
  permissions = SHOPPING_ALL,
  world = defaultRuntimeOptions(),
}: ShoppingSetup): ReturnType<typeof renderApp> & {
  world: FormRuntimeWorld;
} => {
  const runtime = formRuntimeWorld(world);
  server.use(
    ...authWorld({
      hasRefreshCookie: true,
      modules: shoppingListModules(permissions),
    }).handlers,
    ...runtime.handlers,
  );
  return { ...renderApp({ path }), world: runtime };
};
