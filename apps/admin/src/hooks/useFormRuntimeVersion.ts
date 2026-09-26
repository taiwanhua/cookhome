import { useMemo } from "react";

import type { FormDefinition } from "@repo/domain/form";
import { useFormRuntimeVersionQuery } from "@repo/graphql";

import { definitionOf } from "@/lib/form-engine/definition";

import { useSession } from "./useSession";

/**
 * 填寫 / 詳情渲染要的版本定義(已發布或已退役版;api `formRuntimeVersion`,填寫者不需要
 * `system.forms.view`)。提交綁哪一版就讀哪一版 —— 改版不影響舊單的顯示。
 */
export const useFormRuntimeVersion = (
  formKey: string | null,
  version: number | null,
) => {
  const { session } = useSession();
  const query = useFormRuntimeVersionQuery(
    session.client,
    { formKey: formKey ?? "", version: version ?? 0 },
    {
      enabled: formKey !== null && version !== null,
      staleTime: Number.POSITIVE_INFINITY,
    },
  );
  const raw = query.data?.formRuntimeVersion.formVersion;
  const definition = useMemo<FormDefinition | null>(
    () => (raw === undefined ? null : definitionOf(raw)),
    [raw],
  );
  return {
    definition,
    /** 租戶時區(日期時間欄的輸入 / 顯示、表達式的 `ctx.timezone`);還沒載到為 null */
    timezone: query.data?.formRuntimeVersion.timezone ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
};
