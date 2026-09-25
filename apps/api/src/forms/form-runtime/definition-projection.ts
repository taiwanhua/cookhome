import type { FieldDef, ValueSource } from "@repo/domain/form";

import type { FieldGate } from "../field-permission-gate";

/** 骨架的 `valueSource`:只留種類,公式與固定值不給。 */
function skeletonSourceOf(source: ValueSource): ValueSource {
  switch (source.kind) {
    case "computed": {
      return { kind: "computed", expr: null };
    }
    case "constant": {
      return { kind: "constant", value: null };
    }
    default: {
      return { kind: "input" };
    }
  }
}

/**
 * 讀者讀不到的欄位只回渲染需要的骨架:key / label / type / `widget.kind` / `valueSource.kind` /
 * `permission` 旗標,另標 `redacted: true`(前端據此整格不渲染,不必自己從權限 key 推)。
 * 內容一律省略:`constant.value`、計算公式(可能內嵌常數)、`options`(靜態清單 / 類別 key / lookup 來源)、
 * `rules`、`help`、條件、引用來源。
 */
function skeletonOf(field: FieldDef): FieldDef {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    widget: { kind: field.widget.kind },
    valueSource: skeletonSourceOf(field.valueSource),
    permission: field.permission ?? null,
    redacted: true,
  };
}

/**
 * `formRuntimeVersion` 的欄位定義投影(`docs/modules/forms.md`「讀取投影」):讀得到的欄位照回,
 * 讀不到的(沒有自己的 `show`,或計算欄位沿依賴鏈引用到沒有 `show` 的受保護欄位)換成骨架。
 * 判準與提交的值投影同一支(`field-permission-gate.ts` 的 `canShow`),所以權限列被刪、
 * 模組 `*` 不放行這些 mapper 規則也一致。
 */
export function projectFieldsForReader(
  fields: readonly FieldDef[],
  gate: FieldGate,
): FieldDef[] {
  return fields.map((field) =>
    gate.canShow(fields, field.key) ? field : skeletonOf(field),
  );
}
