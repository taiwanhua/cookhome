import { HttpResponse } from "msw";

import {
  type CreateFormVersionDraftMutationVariables,
  type DeleteRetiredPermissionMutationVariables,
  type FormFieldsFragment,
  type FormVersionFieldsFragment,
  type FormVersionQueryVariables,
  FormVersionStatus,
  type FormsQueryVariables,
  ModuleEngine,
  type PublishFormVersionMutationVariables,
  type RetiredFormPermissionsQuery,
  type SaveFormVersionDraftMutationVariables,
  type SetModuleListColumnsMutationVariables,
} from "@repo/graphql";

import { type AuthErrorCode, graphqlError } from "./auth-handlers";
import type { FormFailure } from "./form-runtime-handlers";
import { api } from "./server";

export type FormDesignOperation =
  | "SaveFormVersionDraft"
  | "PublishFormVersion"
  | "CreateForm"
  | "DeleteRetiredPermission"
  | "SetModuleListColumns";

type RetiredPermission =
  RetiredFormPermissionsQuery["retiredFormPermissions"]["items"][number];

export interface FormDesignWorldOptions {
  forms?: FormFieldsFragment[];
  /** 表單 key → 全部版本(含草稿) */
  versions?: Record<string, FormVersionFieldsFragment[]>;
  retired?: RetiredPermission[];
  /** 依權限 key 決定 `deleteRetiredPermission` 的回應(沒列 = 直接刪) */
  retiredOutcomes?: Record<string, FormFailure>;
  failures?: Partial<Record<FormDesignOperation, FormFailure>>;
}

export interface FormDesignWorld {
  handlers: Parameters<typeof import("./server").server.use>;
  inputs: {
    saveFormVersionDraft: SaveFormVersionDraftMutationVariables["input"][];
    publishFormVersion: PublishFormVersionMutationVariables["input"][];
    createFormVersionDraft: CreateFormVersionDraftMutationVariables["input"][];
    deleteRetiredPermission: DeleteRetiredPermissionMutationVariables["input"][];
    setModuleListColumns: SetModuleListColumnsMutationVariables["input"][];
  };
}

const notFound = () => graphqlError("NOT_FOUND" as AuthErrorCode);

/**
 * 表單設計端的假 api(docs/modules/forms.md「api 介面」設計端)。有狀態:存草稿 `draftRevision + 1`、
 * `expectedDraftRevision` 不符 → `CONFLICT`;發布把草稿變成新的已發布版、前一版退役。
 * 檢查器與權限的真正判斷在 api 測試;這裡只給畫面需要的形狀與分支。
 */
export const formDesignWorld = (
  options: FormDesignWorldOptions = {},
): FormDesignWorld => {
  const forms = structuredClone(options.forms ?? []);
  const versions = structuredClone(options.versions ?? {});
  const retired = structuredClone(options.retired ?? []);
  const failures = options.failures ?? {};
  const inputs: FormDesignWorld["inputs"] = {
    saveFormVersionDraft: [],
    publishFormVersion: [],
    createFormVersionDraft: [],
    deleteRetiredPermission: [],
    setModuleListColumns: [],
  };

  const fail = (operation: FormDesignOperation) => {
    const failure = failures[operation];
    return failure === undefined
      ? null
      : graphqlError(
          failure.code as AuthErrorCode,
          failure.code,
          failure.extensions ?? {},
        );
  };
  const versionsOf = (formKey: string) => versions[formKey] ?? [];
  const draftOf = (formKey: string) =>
    versionsOf(formKey).find((item) => item.status === FormVersionStatus.Draft);
  const noIssues = { errors: [], warnings: [] };

  const handlers = [
    api.query("Forms", ({ variables }) => {
      const { input } = variables as FormsQueryVariables;
      const items = forms.filter(
        (form) => input.moduleKey == null || form.moduleKey === input.moduleKey,
      );
      return HttpResponse.json({
        data: {
          forms: { items, totalCount: items.length, page: 1, pageSize: 100 },
        },
      });
    }),
    api.query("FormEngineModules", () =>
      HttpResponse.json({
        data: {
          me: {
            modules: [
              {
                id: "m-shop",
                key: "shopping-list",
                name: "購物清單",
                engine: ModuleEngine.Form,
              },
              {
                id: "m-overview",
                key: "overview",
                name: "總覽",
                engine: ModuleEngine.Fixed,
              },
            ],
          },
        },
      }),
    ),
    api.query("FormVersions", ({ variables }) => {
      const { formKey } = variables as { formKey: string };
      const items = versionsOf(formKey);
      return HttpResponse.json({
        data: { formVersions: { items, totalCount: items.length } },
      });
    }),
    api.query("FormVersion", ({ variables }) => {
      const { formKey, version } = variables as FormVersionQueryVariables;
      const found =
        version == null
          ? draftOf(formKey)
          : versionsOf(formKey).find((item) => item.version === version);
      return found === undefined
        ? notFound()
        : HttpResponse.json({
            data: { formVersion: { formVersion: found, validation: noIssues } },
          });
    }),
    api.mutation("SaveFormVersionDraft", ({ variables }) => {
      const { input } = variables as SaveFormVersionDraftMutationVariables;
      inputs.saveFormVersionDraft.push(input);
      const draft = draftOf(input.formKey);
      if (draft === undefined) {
        return notFound();
      }
      const failure = fail("SaveFormVersionDraft");
      if (failure !== null) {
        return failure;
      }
      if (draft.draftRevision !== input.expectedDraftRevision) {
        return graphqlError("CONFLICT" as AuthErrorCode, "CONFLICT", {
          reason: "DRAFT_REVISION_MISMATCH",
        });
      }
      Object.assign(draft, {
        fields: input.fields,
        layout: input.layout,
        summaryMap: input.summaryMap,
        prefills: input.prefills,
        draftRevision: draft.draftRevision + 1,
      });
      return HttpResponse.json({
        data: {
          saveFormVersionDraft: { formVersion: draft, validation: noIssues },
        },
      });
    }),
    api.mutation("CreateFormVersionDraft", ({ variables }) => {
      const { input } = variables as CreateFormVersionDraftMutationVariables;
      inputs.createFormVersionDraft.push(input);
      const form = forms.find((item) => item.key === input.formKey);
      const base = versionsOf(input.formKey).find(
        (item) => item.version === input.baseVersion,
      );
      if (form === undefined) {
        return notFound();
      }
      const draft: FormVersionFieldsFragment = {
        ...(base ?? {
          fields: [],
          layout: { sections: [] },
          summaryMap: {},
          prefills: [],
        }),
        id: `ver-${input.formKey}-draft`,
        formKey: input.formKey,
        version: null,
        status: FormVersionStatus.Draft,
        draftRevision: 1,
        baseVersion: input.baseVersion ?? null,
        changelog: null,
        publishedAt: null,
        publishedBy: null,
        createdAt: "2026-09-21T00:00:00.000Z",
        updatedAt: "2026-09-21T00:00:00.000Z",
      };
      versions[input.formKey] = [draft, ...versionsOf(input.formKey)];
      form.hasDraft = true;
      return HttpResponse.json({
        data: {
          createFormVersionDraft: { formVersion: draft, validation: noIssues },
        },
      });
    }),
    api.mutation("PublishFormVersion", ({ variables }) => {
      const { input } = variables as PublishFormVersionMutationVariables;
      inputs.publishFormVersion.push(input);
      const failure = fail("PublishFormVersion");
      if (failure !== null) {
        return failure;
      }
      const draft = draftOf(input.formKey);
      const form = forms.find((item) => item.key === input.formKey);
      if (draft === undefined || form === undefined) {
        return notFound();
      }
      const next =
        Math.max(
          0,
          ...versionsOf(input.formKey).map((item) => item.version ?? 0),
        ) + 1;
      for (const item of versionsOf(input.formKey)) {
        if (item.status === FormVersionStatus.Published) {
          item.status = FormVersionStatus.Retired;
        }
      }
      Object.assign(draft, {
        status: FormVersionStatus.Published,
        version: next,
        changelog: input.changelog,
        publishedAt: "2026-09-21T00:00:00.000Z",
      });
      Object.assign(form, { currentVersion: next, hasDraft: false });
      return HttpResponse.json({
        data: { publishFormVersion: { formVersion: draft } },
      });
    }),
    api.query("RetiredFormPermissions", () =>
      HttpResponse.json({
        data: {
          retiredFormPermissions: {
            items: retired,
            totalCount: retired.length,
          },
        },
      }),
    ),
    api.mutation("DeleteRetiredPermission", ({ variables }) => {
      const { input } = variables as DeleteRetiredPermissionMutationVariables;
      inputs.deleteRetiredPermission.push(input);
      const outcome = options.retiredOutcomes?.[input.permissionKey];
      const needsConfirm = outcome?.extensions?.reasons;
      const isConfirmOnly =
        Array.isArray(needsConfirm) &&
        needsConfirm.includes("CONFIRM_REQUIRED");
      if (
        outcome !== undefined &&
        !(isConfirmOnly && input.confirmCompletedUsage === true)
      ) {
        return graphqlError(
          outcome.code as AuthErrorCode,
          outcome.code,
          outcome.extensions ?? {},
        );
      }
      const index = retired.findIndex(
        (item) => item.key === input.permissionKey,
      );
      const removed = index === -1 ? undefined : retired.splice(index, 1).at(0);
      return HttpResponse.json({
        data: {
          deleteRetiredPermission: {
            success: true,
            deletedKey: input.permissionKey,
            usage: removed?.usage ?? {
              draftCount: 0,
              draftVersions: [],
              completedCount: 0,
              completedVersions: [],
            },
          },
        },
      });
    }),
    api.mutation("SetModuleListColumns", ({ variables }) => {
      const { input } = variables as SetModuleListColumnsMutationVariables;
      inputs.setModuleListColumns.push(input);
      const failure = fail("SetModuleListColumns");
      return (
        failure ??
        HttpResponse.json({
          data: {
            setModuleListColumns: {
              moduleKey: input.moduleKey,
              columns: input.columns.map((column) => ({
                ...column,
                formKey: column.formKey ?? null,
              })),
            },
          },
        })
      );
    }),
  ];

  return { handlers, inputs };
};
