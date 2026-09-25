import { type GraphQLResponseBody, HttpResponse } from "msw";

import type { FormDefinition } from "@repo/domain/form";
import {
  type CreateFormDraftMutationVariables,
  type FormFieldOptionsQuery,
  type FormFieldOptionsQueryVariables,
  type FormLookupQuery,
  type FormLookupQueryVariables,
  type FormRuntimeVersionQueryVariables,
  type FormSubmissionFieldsFragment,
  type FormSubmissionQueryVariables,
  FormSubmissionStatus,
  type FormSubmissionsQueryVariables,
  FormVersionStatus,
  type ModuleFormsQuery,
  type ModuleListColumn,
  type ModuleListColumnsQueryVariables,
  type SaveFormDraftMutationVariables,
  type SubmitFormSubmissionMutationVariables,
  type UpdateFormSubmissionMutationVariables,
} from "@repo/graphql";

import { rawOf } from "@/lib/form-engine/definition";

import { type AuthErrorCode, graphqlError } from "./auth-handlers";
import { submissionFragment } from "./form-fixtures";
import { api } from "./server";

export type FormRuntimeOperation =
  | "FormFieldOptions"
  | "CreateFormDraft"
  | "SaveFormDraft"
  | "SubmitFormSubmission"
  | "UpdateFormSubmission"
  | "DeleteFormSubmission";

export interface FormFailure {
  code: string;
  extensions?: Record<string, unknown>;
}

export interface FormRuntimeWorldOptions {
  moduleForms?: ModuleFormsQuery["moduleForms"];
  /** `<formKey>@<version>` → 定義 */
  versions?: Partial<Record<string, FormDefinition>>;
  submissions?: FormSubmissionFieldsFragment[];
  /** 模組 key → 列表欄位配置(沒給 = 空陣列) */
  listColumns?: Record<string, ModuleListColumn[]>;
  lookupRecords?: FormLookupQuery["formLookup"]["items"];
  /** 欄位 key → `formFieldOptions` 回的類別選項(沒給 = 空清單) */
  fieldOptions?: Record<
    string,
    FormFieldOptionsQuery["formFieldOptions"]["items"]
  >;
  /** 提交 id → 修訂號 → 那個修訂的完整快照(`formSubmission(id, revision)` 用;沒給就回目前的值) */
  snapshots?: Record<string, Record<number, Record<string, unknown>>>;
  failures?: Partial<Record<FormRuntimeOperation, FormFailure>>;
}

export interface FormRuntimeWorld {
  handlers: Parameters<typeof import("./server").server.use>;
  inputs: {
    createFormDraft: CreateFormDraftMutationVariables["input"][];
    saveFormDraft: SaveFormDraftMutationVariables["input"][];
    submitFormSubmission: SubmitFormSubmissionMutationVariables["input"][];
    updateFormSubmission: UpdateFormSubmissionMutationVariables["input"][];
    formSubmissions: FormSubmissionsQueryVariables["input"][];
    formLookup: FormLookupQueryVariables["input"][];
    formFieldOptions: FormFieldOptionsQueryVariables["input"][];
  };
}

const notFound = () => graphqlError("NOT_FOUND" as AuthErrorCode);

/** 樂觀鎖沒搶到(與 api 同一個 code / reason)。 */
const conflict = () =>
  graphqlError("CONFLICT" as AuthErrorCode, "CONFLICT", {
    reason: "EDIT_VERSION_MISMATCH",
  });

/**
 * 表單執行端的假 api(docs/modules/forms.md「api 介面」執行端)。有狀態:建草稿 / 存 / 送 / 改寫回同一份清單,
 * 每次寫入 `editVersion + 1`、已完成修改 `revision + 1`;`expectedEditVersion` 不符 → `CONFLICT`(與 api 同)。
 * 不模擬欄位級投影與條件:那些由 api 測試覆蓋,這裡只給畫面需要的形狀。
 */
export const formRuntimeWorld = (
  options: FormRuntimeWorldOptions = {},
): FormRuntimeWorld => {
  const {
    moduleForms = [],
    versions = {},
    lookupRecords = [],
    failures = {},
  } = options;
  const listColumns = options.listColumns ?? {};
  const state: FormSubmissionFieldsFragment[] = structuredClone(
    options.submissions ?? [],
  );
  const inputs: FormRuntimeWorld["inputs"] = {
    createFormDraft: [],
    saveFormDraft: [],
    submitFormSubmission: [],
    updateFormSubmission: [],
    formSubmissions: [],
    formLookup: [],
    formFieldOptions: [],
  };
  let created = 0;

  const fail = (operation: FormRuntimeOperation) => {
    const failure = failures[operation];
    return failure === undefined
      ? null
      : graphqlError(
          failure.code as AuthErrorCode,
          failure.code,
          failure.extensions ?? {},
        );
  };
  const find = (id: string) => state.find((item) => item.id === id);
  /** 單筆 payload(`{ <操作名>: { submission } }`);型別交給各 handler 的回傳推導。 */
  const payload = (name: string, submission: FormSubmissionFieldsFragment) =>
    HttpResponse.json<GraphQLResponseBody<Record<string, never>>>({
      data: { [name]: { submission } } as Record<string, never>,
    });

  const handlers = [
    api.query("ModuleForms", () =>
      HttpResponse.json({ data: { moduleForms } }),
    ),
    api.query("ModuleListColumns", ({ variables }) => {
      const { moduleKey } = variables as ModuleListColumnsQueryVariables;
      return HttpResponse.json({
        data: {
          moduleListColumns: {
            moduleKey,
            columns: listColumns[moduleKey] ?? [],
          },
        },
      });
    }),
    api.query("FormRuntimeVersion", ({ variables }) => {
      const { formKey, version } =
        variables as FormRuntimeVersionQueryVariables;
      const definition = versions[`${formKey}@${String(version)}`];
      return definition === undefined
        ? notFound()
        : HttpResponse.json({
            data: {
              formRuntimeVersion: {
                formVersion: {
                  id: `ver-${formKey}-${String(version)}`,
                  formKey,
                  version,
                  status: FormVersionStatus.Published,
                  ...rawOf(definition),
                },
              },
            },
          });
    }),
    api.query("FormSubmissions", ({ variables }) => {
      const { input } = variables as FormSubmissionsQueryVariables;
      inputs.formSubmissions.push(input);
      const keyword = input.keyword?.trim() ?? "";
      const items = state.filter(
        (item) =>
          item.moduleKey === input.moduleKey &&
          (input.formKey == null || item.formKey === input.formKey) &&
          (input.status == null || item.status === input.status) &&
          (keyword === "" || (item.summary?.title ?? "").includes(keyword)),
      );
      return HttpResponse.json({
        data: {
          formSubmissions: {
            items,
            totalCount: items.length,
            page: input.page ?? 1,
            pageSize: input.pageSize ?? 20,
          },
        },
      });
    }),
    api.query("FormSubmission", ({ variables }) => {
      const { id, revision } = variables as FormSubmissionQueryVariables;
      const item = find(id);
      if (item === undefined) {
        return notFound();
      }
      const snapshot =
        revision == null ? undefined : options.snapshots?.[id]?.[revision];
      return payload(
        "formSubmission",
        snapshot === undefined
          ? item
          : {
              ...item,
              values: snapshot,
              viewedRevision: revision ?? item.revision,
            },
      );
    }),
    api.query("FormLookup", ({ variables }) => {
      const { input } = variables as FormLookupQueryVariables;
      inputs.formLookup.push(input);
      return HttpResponse.json({
        data: {
          formLookup: {
            items: lookupRecords,
            totalCount: lookupRecords.length,
            page: 1,
            pageSize: 20,
          },
        },
      });
    }),
    api.query("FormFieldOptions", ({ variables }) => {
      const { input } = variables as FormFieldOptionsQueryVariables;
      inputs.formFieldOptions.push(input);
      const failure = fail("FormFieldOptions");
      if (failure !== null) {
        return failure;
      }
      // 與 api 同:keyword 比對 label / value(不分大小寫),再依 page / pageSize 切
      const keyword = input.keyword?.trim().toLowerCase() ?? "";
      const matched = (options.fieldOptions?.[input.fieldKey] ?? []).filter(
        (item) =>
          keyword === "" ||
          item.label.toLowerCase().includes(keyword) ||
          item.value.toLowerCase().includes(keyword),
      );
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 100;
      return HttpResponse.json({
        data: {
          formFieldOptions: {
            items: matched.slice((page - 1) * pageSize, page * pageSize),
            totalCount: matched.length,
            page,
            pageSize,
          },
        },
      });
    }),
    api.mutation("CreateFormDraft", ({ variables }) => {
      const { input } = variables as CreateFormDraftMutationVariables;
      inputs.createFormDraft.push(input);
      const failure = fail("CreateFormDraft");
      if (failure !== null) {
        return failure;
      }
      created += 1;
      const submission = submissionFragment({
        id: `sub-new-${String(created)}`,
        formKey: input.formKey,
        status: FormSubmissionStatus.Draft,
        revision: 0,
        revisions: [],
        values: input.values ?? {},
        summary: null,
        submittedAt: null,
        editVersion: 1,
      });
      state.push(submission);
      return payload("createFormDraft", submission);
    }),
    api.mutation("SaveFormDraft", ({ variables }) => {
      const { input } = variables as SaveFormDraftMutationVariables;
      inputs.saveFormDraft.push(input);
      const target = find(input.id);
      if (target === undefined) {
        return notFound();
      }
      const failure = fail("SaveFormDraft");
      if (failure !== null) {
        return failure;
      }
      if (target.editVersion !== input.expectedEditVersion) {
        return conflict();
      }
      Object.assign(target, {
        values: input.values,
        editVersion: target.editVersion + 1,
      });
      return payload("saveFormDraft", target);
    }),
    api.mutation("SubmitFormSubmission", ({ variables }) => {
      const { input } = variables as SubmitFormSubmissionMutationVariables;
      inputs.submitFormSubmission.push(input);
      const target = find(input.id);
      if (target === undefined) {
        return notFound();
      }
      const failure = fail("SubmitFormSubmission");
      if (failure !== null) {
        return failure;
      }
      Object.assign(target, {
        status: FormSubmissionStatus.Completed,
        revision: 1,
        editVersion: target.editVersion + 1,
        summary: {
          title:
            typeof target.values.item === "string" ? target.values.item : "",
          date: null,
          amount: null,
        },
      });
      return payload("submitFormSubmission", target);
    }),
    api.mutation("UpdateFormSubmission", ({ variables }) => {
      const { input } = variables as UpdateFormSubmissionMutationVariables;
      inputs.updateFormSubmission.push(input);
      const target = find(input.id);
      if (target === undefined) {
        return notFound();
      }
      const failure = fail("UpdateFormSubmission");
      if (failure !== null) {
        return failure;
      }
      if (target.editVersion !== input.expectedEditVersion) {
        return conflict();
      }
      Object.assign(target, {
        values: input.values,
        revision: target.revision + 1,
        editVersion: target.editVersion + 1,
      });
      return payload("updateFormSubmission", target);
    }),
    api.mutation("DeleteFormSubmission", ({ variables }) => {
      const { input } = variables as { input: { id: string } };
      const failure = fail("DeleteFormSubmission");
      if (failure !== null) {
        return failure;
      }
      const index = state.findIndex((item) => item.id === input.id);
      if (index !== -1) {
        state.splice(index, 1);
      }
      return HttpResponse.json({
        data: { deleteFormSubmission: { success: true, deletedId: input.id } },
      });
    }),
  ];

  return { handlers, inputs };
};
