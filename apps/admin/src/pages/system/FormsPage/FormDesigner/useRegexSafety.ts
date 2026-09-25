import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { FormDefinition, RegexSafetyCheck } from "@repo/domain/form";

/** 還沒載到 recheck:先當安全(api 存草稿 / 發布時照驗)。 */
const assumeSafe: RegexSafetyCheck = () => true;

/** 同一條正則只檢查一次(recheck 單次可能花上數百毫秒)。 */
const memoizedCheck = (check: RegexSafetyCheck): RegexSafetyCheck => {
  const verdicts = new Map<string, boolean>();
  return (source) => {
    const known = verdicts.get(source);
    if (known !== undefined) {
      return known;
    }
    const verdict = check(source);
    verdicts.set(source, verdict);
    return verdict;
  };
};

/**
 * 設計器即時檢查器的 ReDoS 檢查(Spec 6a §5「正則」)。recheck 的瀏覽器版約 2.9 MB,**不進首屏 bundle**:
 * 草稿裡出現 `rules.pattern` 才以動態 `import()` 懶載入 `@repo/domain/form-regex-safety`。
 *
 * 載到之前(或載入失敗)一律先當「安全」—— 這只是設計器的即時提示,存草稿與發布時 api 以同一顆引擎再驗,
 * 不安全的正則在那一步一定會被擋下(`VALIDATION_FAILED` + `PATTERN_UNSAFE`)。
 */
export const useRegexSafety = (
  definition: FormDefinition,
): RegexSafetyCheck => {
  const patterns = useMemo(
    () =>
      definition.fields
        .map((field) => field.rules?.pattern ?? "")
        .filter((pattern) => pattern !== ""),
    [definition.fields],
  );
  const module = useQuery({
    queryKey: ["form-regex-safety"],
    queryFn: () => import("@repo/domain/form-regex-safety"),
    enabled: patterns.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const check = module.data?.recheckRegexSafety;

  return useMemo(
    () => (check === undefined ? assumeSafe : memoizedCheck(check)),
    [check],
  );
};
