import type { FieldDef, StoredValues } from "@repo/domain/form";

/**
 * 修訂差異(Spec 6a §4 `revisions[]`):每個修訂號存的是**完整值快照**,差異在讀取時由相鄰兩筆算。
 * 比的是「識別」而不是整個物件(與 api 判「沒動」同一套,docs/modules/forms.md「提交的寫入規則」):
 * 選項比 value(多選比集合)、引用比 id、上傳比 path;受保護且讀者看不到的欄位兩邊都是 `"[redacted]"`,
 * 所以永遠不會被列成有變動(不從差異側漏)。
 */

export interface RevisionChange {
  field: FieldDef;
  before: unknown;
  after: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const identityOf = (value: unknown): unknown => {
  if (isRecord(value)) {
    return value.id ?? value.path ?? value.value ?? JSON.stringify(value);
  }
  return value === "" || value === undefined ? null : value;
};

const sameValue = (left: unknown, right: unknown): boolean => {
  if (Array.isArray(left) || Array.isArray(right)) {
    const leftSet = new Set(
      (Array.isArray(left) ? left : []).map((item) => String(identityOf(item))),
    );
    const rightSet = new Set(
      (Array.isArray(right) ? right : []).map((item) =>
        String(identityOf(item)),
      ),
    );
    return (
      leftSet.size === rightSet.size &&
      [...leftSet].every((item) => rightSet.has(item))
    );
  }
  return identityOf(left) === identityOf(right);
};

/** 前一修訂 → 這一修訂,依定義的欄位順序列出有變動的欄位。 */
export const revisionChanges = (
  fields: readonly FieldDef[],
  previous: StoredValues,
  current: StoredValues,
): RevisionChange[] =>
  fields
    .filter((field) => !sameValue(previous[field.key], current[field.key]))
    .map((field) => ({
      field,
      before: previous[field.key] ?? null,
      after: current[field.key] ?? null,
    }));
