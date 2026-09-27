import { COLLATION_LOCALE } from "./collation";
import { referencedFieldKeys } from "./expression-shape";
import type { FieldDef } from "./types";

/**
 * 欄位之間的依賴:計算順序(拓樸排序)與受保護依賴鏈(Spec §5「受保護欄位的配套」)。
 */

/** 計算欄位的公式引用到哪些欄位;非計算欄位回空陣列。 */
export function computedDependenciesOf(field: FieldDef): string[] {
  return field.valueSource.kind === "computed"
    ? referencedFieldKeys(field.valueSource.expr)
    : [];
}

/** 公式引用成圈時丟出;檢查器會先以 `EXPR_CYCLE` 擋下,正常流程走不到。 */
export class ComputedCycleError extends Error {
  override name = "ComputedCycleError";
}

/**
 * 計算欄位的求值順序:被引用的計算欄位排在引用它的前面(引用非計算欄位不影響順序)。
 * 成圈 → `ComputedCycleError`。
 */
export function computedOrder(fields: readonly FieldDef[]): FieldDef[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const ordered: FieldDef[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (field: FieldDef, trail: string[]): void => {
    const current = state.get(field.key);
    if (current === "done") {
      return;
    }
    if (current === "visiting") {
      throw new ComputedCycleError(
        `計算欄位循環引用:${[...trail, field.key].join(" → ")}`,
      );
    }
    state.set(field.key, "visiting");
    for (const key of computedDependenciesOf(field)) {
      const dependency = byKey.get(key);
      if (dependency?.valueSource.kind === "computed") {
        visit(dependency, [...trail, field.key]);
      }
    }
    state.set(field.key, "done");
    ordered.push(field);
  };
  for (const field of fields) {
    if (field.valueSource.kind === "computed") {
      visit(field, []);
    }
  }
  return ordered;
}

/**
 * 一個欄位的受保護資訊:
 * - `self`:自己設了 `permission.show`
 * - `via`:沿計算依賴鏈(遞迴)引用到的、**自己設了 show** 的欄位 key
 *
 * 讀得到某欄位 = 它自己的 show(若 `self`)且 `via` 每一個的 show 都有。
 */
export interface FieldProtection {
  self: boolean;
  via: string[];
}

export function isProtected(protection: FieldProtection | undefined): boolean {
  return (
    protection !== undefined && (protection.self || protection.via.length > 0)
  );
}

/**
 * 每個欄位的受保護資訊。例:`total = unit_price × qty`、`total_tax = total × 1.05`,
 * `unit_price` 受保護 → `total.via = ["unit_price"]`、`total_tax.via = ["unit_price"]`;
 * `total_tax` 自己也設 show → `total_tax.self = true`。
 * 引用成圈時,圈上的依賴只走一次(不會無窮遞迴;成圈本身由檢查器報錯)。
 */
export function fieldProtections(
  fields: readonly FieldDef[],
): Map<string, FieldProtection> {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const memo = new Map<string, Set<string>>();

  const viaOf = (field: FieldDef, visiting: Set<string>): Set<string> => {
    const cached = memo.get(field.key);
    if (cached) {
      return cached;
    }
    const via = new Set<string>();
    visiting.add(field.key);
    for (const key of computedDependenciesOf(field)) {
      const dependency = byKey.get(key);
      if (!dependency || visiting.has(key)) {
        continue;
      }
      if (dependency.permission?.show === true) {
        via.add(key);
      }
      for (const inherited of viaOf(dependency, visiting)) {
        via.add(inherited);
      }
    }
    visiting.delete(field.key);
    memo.set(field.key, via);
    return via;
  };

  const result = new Map<string, FieldProtection>();
  for (const field of fields) {
    const via = [...viaOf(field, new Set())].filter((key) => key !== field.key);
    result.set(field.key, {
      self: field.permission?.show === true,
      via: via.toSorted((left, right) =>
        left.localeCompare(right, COLLATION_LOCALE),
      ),
    });
  }
  return result;
}

/**
 * 讀取某欄位需要哪些欄位的 `show` 權限(自己若設 show 也算);空陣列 = 公開欄位。
 * 欄位不存在回空陣列。
 */
export function requiredShowFieldsFor(
  fields: readonly FieldDef[],
  fieldKey: string,
): string[] {
  const protection = fieldProtections(fields).get(fieldKey);
  if (!protection) {
    return [];
  }
  return protection.self ? [fieldKey, ...protection.via] : protection.via;
}
