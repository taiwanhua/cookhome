import { useTranslations } from "use-intl";

import {
  FORM_SUBMISSION_PROVIDER,
  type FieldDef,
  type FieldType,
  type LookupSourceDescriptor,
  fieldProtections,
  isProtected,
} from "@repo/domain/form";
import { useFormVersionQuery, useFormsQuery } from "@repo/graphql";

import { useSession } from "@/hooks/useSession";

/**
 * lookup 來源的「可挑的表單 / 欄位」(Spec 6a §5「lookup 來源」;表 A:類別與表單 / 欄位**用下拉選**,不打字)。
 *
 * - `user` / `org`:api 登錄表(`apps/api/src/forms/lookup-providers.ts`)宣告的欄位與型別
 * - `form_submission`:表單 = 本租戶看得到(`forms` 查詢本來就依視角過濾)且**有已發布版本**的表單;
 *   欄位目錄 = 摘要槽 + 該表單**目前版本**的非受保護欄位(因引用而受保護的計算欄位也不列)—— 與 api 的
 *   `formSubmissionCatalog` 同一個判準
 *
 * 每個欄位帶型別,帶入對應表用它只列型別相容的來源欄位(`isPrefillCompatible`,與檢查器同一支)。
 */
const PROVIDER_FIELD_TYPES: Readonly<
  Partial<Record<string, Readonly<Record<string, FieldType>>>>
> = {
  user: { name: "text", account: "text", email: "text" },
  org: { name: "text", slug: "text" },
};

/** 換 provider 時的預設顯示欄(該 provider 的第一個欄位;表單提交 = 摘要槽「標題」)。 */
export const defaultLabelFieldOf = (provider: string): string =>
  Object.keys(PROVIDER_FIELD_TYPES[provider] ?? {}).at(0) ?? "title";

const SUMMARY_SLOT_TYPES: Readonly<Record<string, FieldType>> = {
  title: "text",
  date: "date",
  amount: "number",
};

/** 表單下拉一次取幾張(api 上限 100;與表單管理左清單同一把 query key)。 */
const FORMS_PAGE_SIZE = 100;

export interface LookupFieldOption {
  value: string;
  label: string;
  type: FieldType;
}

export interface PublishedFormOption {
  key: string;
  name: string;
  currentVersion: number;
}

/** 本租戶看得到、有已發布版本的表單(`enabled` = 只有選了「表單提交」才查)。 */
export const usePublishedForms = (enabled: boolean): PublishedFormOption[] => {
  const { session } = useSession();
  const forms = useFormsQuery(
    session.client,
    { input: { keyword: "", page: 1, pageSize: FORMS_PAGE_SIZE } },
    { enabled },
  );
  return (forms.data?.forms.items ?? []).flatMap((form) =>
    form.currentVersion === null || form.currentVersion === undefined
      ? []
      : [
          {
            key: form.key,
            name: form.name,
            currentVersion: form.currentVersion,
          },
        ],
  );
};

/**
 * 來源可挑的欄位;`null` = 還挑不了(表單提交還沒選表單、欄位目錄載入中),呼叫端顯示停用的下拉。
 * 表單提交的欄位目錄查該表單目前版本(`formVersion`)。
 */
export const useLookupFieldOptions = (
  source: LookupSourceDescriptor,
): LookupFieldOption[] | null => {
  const t = useTranslations("admin.forms.lookupSource");
  const { session } = useSession();
  const isSubmission = source.provider === FORM_SUBMISSION_PROVIDER;
  const forms = usePublishedForms(isSubmission);
  const form = isSubmission
    ? forms.find((candidate) => candidate.key === source.formKey)
    : undefined;
  const version = useFormVersionQuery(
    session.client,
    { formKey: form?.key ?? "", version: form?.currentVersion ?? 0 },
    { enabled: form !== undefined, retry: false },
  );

  const known = PROVIDER_FIELD_TYPES[source.provider];
  if (known !== undefined) {
    return Object.entries(known).map(([field, type]) => ({
      value: field,
      label: t(`fields.${field}`),
      type,
    }));
  }
  if (!isSubmission || version.data === undefined) {
    return null;
  }
  const fields = version.data.formVersion.formVersion
    .fields as unknown as FieldDef[];
  const protections = fieldProtections(fields);
  return [
    ...Object.entries(SUMMARY_SLOT_TYPES).map(([slot, type]) => ({
      value: slot,
      label: t(`summarySlots.${slot}`),
      type,
    })),
    ...fields
      .filter((field) => !isProtected(protections.get(field.key)))
      .map((field) => ({
        value: field.key,
        label: `${field.label}(${field.key})`,
        type: field.type,
      })),
  ];
};
