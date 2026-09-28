import { describe, expect, it } from "@jest/globals";
import { screen, within } from "@testing-library/react";
import { useState } from "react";

import { ModuleListColumnKind } from "@repo/graphql";

import { formModulePages } from "@/components/form-engine/FormModulePages/form-module-pages";
import {
  SHOPPING_ALL,
  defaultRuntimeOptions,
} from "@/components/form-engine/FormModulePages/form-module-test-support";
import { FormSubmissionList } from "@/components/form-engine/FormSubmissionList";
import type { ModulePageProps } from "@/lib/module-tree";
import { authWorld } from "@/test/msw/auth-handlers";
import {
  DEMO_FORM_KEY,
  DEMO_FORM_ROUTES,
  demoFormModules,
  submissionFragment,
} from "@/test/msw/form-fixtures";
import { formRuntimeWorld } from "@/test/msw/form-runtime-handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";
import { setupFakeViewport } from "@/test/viewport";

import {
  type ModulePageRegistry,
  ModuleRoute,
} from "./guards/ModuleRoute/ModuleRoute";
import { RequireAuth } from "./guards/RequireAuth";

setupFakeViewport();

/**
 * 客製頁組裝一例(Spec 6a §8「登記與客製」):列表頁自己排版、表單相關的部分用零件綁進去
 * (這裡:自訂欄位的 `FormSubmissionList`),其餘三頁沿用預設。
 */
const CustomShoppingPage = ({ module }: ModulePageProps) => {
  const [page, setPage] = useState(1);
  return (
    <section aria-label="自訂購物頁">
      <h2>{module.name}(自訂)</h2>
      <FormSubmissionList
        moduleKey={DEMO_FORM_KEY}
        filters={{ keyword: "", formKey: null, status: null, page }}
        onPageChange={setPage}
        columns={[
          {
            kind: ModuleListColumnKind.Field,
            key: "unit_price",
            width: 120,
            order: 0,
          },
        ]}
        aria-label="自訂清單"
      />
    </section>
  );
};

const customPages: ModulePageRegistry = {
  ...formModulePages(DEMO_FORM_KEY),
  [DEMO_FORM_KEY]: CustomShoppingPage,
};

describe("formModulePages:預設組裝與客製", () => {
  it("產出四個 key 的預設元件;展開後覆寫單一 key 只換那一頁", () => {
    const defaults = formModulePages(DEMO_FORM_KEY);
    expect(new Set(Object.keys(defaults))).toEqual(
      new Set([
        DEMO_FORM_KEY,
        `${DEMO_FORM_KEY}.view-page`,
        `${DEMO_FORM_KEY}.create-page`,
        `${DEMO_FORM_KEY}.edit-page`,
      ]),
    );
    expect(customPages[DEMO_FORM_KEY]).toBe(CustomShoppingPage);
    // 其餘三頁沿用預設(同一個模組層常數,不是每次呼叫各建一份)
    for (const suffix of ["view-page", "create-page", "edit-page"]) {
      const key = `${DEMO_FORM_KEY}.${suffix}`;
      expect(customPages[key]).toBe(defaults[key]);
      expect(customPages[key]).not.toBe(CustomShoppingPage);
    }
  });

  it("客製列表頁用零件組裝:自訂欄位的 FormSubmissionList 照樣吃提交與版本定義", async () => {
    server.use(
      ...authWorld({
        hasRefreshCookie: true,
        modules: demoFormModules(SHOPPING_ALL),
      }).handlers,
      ...formRuntimeWorld({
        ...defaultRuntimeOptions(),
        submissions: [submissionFragment()],
      }).handlers,
    );
    renderApp({
      path: DEMO_FORM_ROUTES.list,
      extra: (
        <RequireAuth>
          <ModuleRoute pages={customPages} />
        </RequireAuth>
      ),
    });

    const custom = await screen.findByRole("region", { name: "自訂購物頁" });
    expect(
      within(custom).getByText("示範表單(頂層)(自訂)"),
    ).toBeInTheDocument();
    const table = await within(custom).findByRole("table", {
      name: "自訂清單",
    });
    expect(await within(table).findByText("30 元")).toBeInTheDocument();
  });
});
