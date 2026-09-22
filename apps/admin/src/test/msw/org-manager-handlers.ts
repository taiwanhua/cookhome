import { HttpResponse, http } from "msw";

import type {
  CreateChildOrgMutationVariables,
  CreateUploadUrlMutationVariables,
  DeleteOrgMutationVariables,
  MoveOrgMutationVariables,
  OrgQuery,
  OrgQueryVariables,
  OrgTreeQuery,
  ProvisionTenantMutationVariables,
  RevokeTenantProvisionMutationVariables,
  SetOrgEnabledMutationVariables,
  SetOrgVisibilityMutationVariables,
  TenantModuleOptionsQuery,
  TransferOrgOwnerMutationVariables,
  UpdateOrgMutationVariables,
  UsersQuery,
  UsersQueryVariables,
} from "@repo/graphql";

import { type AuthErrorCode, graphqlError } from "./auth-handlers";
import { api } from "./server";

export type TestOrgNode = OrgTreeQuery["orgTree"][number];
export type TestOrg = OrgQuery["org"];
export type TestModuleOption =
  TenantModuleOptionsQuery["tenantModuleOptions"][number];
export type TestOrgUser = UsersQuery["users"]["items"][number];

/** 簽名上傳網址的假位址;`uploadedFiles` 記錄真的被 PUT 上去的東西。 */
export const TEST_UPLOAD_ORIGIN = "https://storage.test";

/** 會被指定失敗的操作(值是 `errors[0].extensions.code`)。 */
export type OrgOperation =
  | "CreateChildOrg"
  | "UpdateOrg"
  | "SetOrgEnabled"
  | "MoveOrg"
  | "DeleteOrg"
  | "ProvisionTenant"
  | "RevokeTenantProvision"
  | "TransferOrgOwner"
  | "SetOrgVisibility"
  | "CreateUploadUrl";

export interface OrgFailure {
  code: string;
  /** 附加在 `extensions` 上的欄位(如 `ORG_NOT_DELETABLE` 的 `reasons`) */
  extensions?: Record<string, unknown>;
}

export interface OrgWorldOptions {
  orgTree?: TestOrgNode[];
  /** `org(id)` 的來源;查不到的 id 回 NOT_FOUND */
  orgs?: TestOrg[];
  /** `users` 的來源(擁有者姓名與轉移候選人) */
  users?: TestOrgUser[];
  moduleOptions?: TestModuleOption[];
  failures?: Partial<Record<OrgOperation, OrgFailure>>;
}

export interface OrgWorld {
  handlers: Parameters<typeof import("./server").server.use>;
  /** 各操作收到的輸入(依序),用來斷言「送出去的是什麼」 */
  inputs: {
    createChildOrg: CreateChildOrgMutationVariables["input"][];
    updateOrg: UpdateOrgMutationVariables["input"][];
    setOrgEnabled: SetOrgEnabledMutationVariables["input"][];
    moveOrg: MoveOrgMutationVariables["input"][];
    deleteOrg: DeleteOrgMutationVariables["input"][];
    provisionTenant: ProvisionTenantMutationVariables["input"][];
    revokeTenantProvision: RevokeTenantProvisionMutationVariables["input"][];
    transferOrgOwner: TransferOrgOwnerMutationVariables["input"][];
    setOrgVisibility: SetOrgVisibilityMutationVariables["input"][];
    createUploadUrl: CreateUploadUrlMutationVariables["input"][];
  };
  /** 直傳到簽名網址的檔案(ADR-0010 第 2 步) */
  uploadedFiles: { url: string; contentType: string | null; size: number }[];
}

/**
 * 組織管理頁的假 api(#134 組織 + #135 租戶作業 + #137 上傳票 + #136 的 `users`)。
 *
 * 商標上傳是三方的:`CreateUploadUrl` 發一張指向 `TEST_UPLOAD_ORIGIN` 的票、
 * 瀏覽器 `PUT` 上去(由 `http.put` 接住並記錄)、`objectPath` 再回到 `updateOrg` /
 * `provisionTenant` 的 `logoPath` — 三步都要攔,少一步測試會撞 `onUnhandledRequest: "error"`。
 */
export const orgWorld = (options: OrgWorldOptions = {}): OrgWorld => {
  const {
    orgTree = [],
    orgs = [],
    users = [],
    moduleOptions = [],
    failures = {},
  } = options;

  const inputs: OrgWorld["inputs"] = {
    createChildOrg: [],
    updateOrg: [],
    setOrgEnabled: [],
    moveOrg: [],
    deleteOrg: [],
    provisionTenant: [],
    revokeTenantProvision: [],
    transferOrgOwner: [],
    setOrgVisibility: [],
    createUploadUrl: [],
  };
  const uploadedFiles: OrgWorld["uploadedFiles"] = [];

  const fail = (operation: OrgOperation) => {
    const failure = failures[operation];
    return failure === undefined
      ? null
      : graphqlError(
          failure.code as AuthErrorCode,
          failure.code,
          failure.extensions ?? {},
        );
  };

  const orgOf = (id: string) => orgs.find((org) => org.id === id);

  const handlers = [
    api.query("OrgTree", () => HttpResponse.json({ data: { orgTree } })),
    api.query("Org", ({ variables }) => {
      const { id } = variables as OrgQueryVariables;
      const org = orgOf(id);
      return org === undefined
        ? graphqlError("FORBIDDEN", "NOT_FOUND")
        : HttpResponse.json({ data: { org } });
    }),
    api.query("Users", ({ variables }) => {
      const { input } = variables as UsersQueryVariables;
      return HttpResponse.json({
        data: {
          users: {
            totalCount: users.length,
            page: input.page ?? 1,
            pageSize: input.pageSize ?? 100,
            items: users,
          },
        },
      });
    }),
    api.query("TenantModuleOptions", () =>
      HttpResponse.json({ data: { tenantModuleOptions: moduleOptions } }),
    ),
    api.mutation("CreateChildOrg", ({ variables }) => {
      const { input } = variables as CreateChildOrgMutationVariables;
      inputs.createChildOrg.push(input);
      return (
        fail("CreateChildOrg") ??
        HttpResponse.json({
          data: {
            createChildOrg: {
              org: {
                id: "org-new",
                name: input.name,
                description: input.description ?? null,
                parentId: input.parentId,
                enabled: true,
              },
            },
          },
        })
      );
    }),
    api.mutation("UpdateOrg", ({ variables }) => {
      const { input } = variables as UpdateOrgMutationVariables;
      inputs.updateOrg.push(input);
      const current = orgOf(input.id);
      return (
        fail("UpdateOrg") ??
        HttpResponse.json({
          data: {
            updateOrg: {
              org: {
                id: input.id,
                name: input.name ?? current?.name ?? "",
                description: input.description ?? null,
                logoUrl: current?.logoUrl ?? null,
              },
            },
          },
        })
      );
    }),
    api.mutation("SetOrgEnabled", ({ variables }) => {
      const { input } = variables as SetOrgEnabledMutationVariables;
      inputs.setOrgEnabled.push(input);
      return (
        fail("SetOrgEnabled") ??
        HttpResponse.json({
          data: {
            setOrgEnabled: { org: { id: input.id, enabled: input.enabled } },
          },
        })
      );
    }),
    api.mutation("MoveOrg", ({ variables }) => {
      const { input } = variables as MoveOrgMutationVariables;
      inputs.moveOrg.push(input);
      return (
        fail("MoveOrg") ??
        HttpResponse.json({
          data: {
            moveOrg: { org: { id: input.id, parentId: input.newParentId } },
          },
        })
      );
    }),
    api.mutation("DeleteOrg", ({ variables }) => {
      const { input } = variables as DeleteOrgMutationVariables;
      inputs.deleteOrg.push(input);
      return (
        fail("DeleteOrg") ??
        HttpResponse.json({
          data: { deleteOrg: { success: true, deletedId: input.id } },
        })
      );
    }),
    api.mutation("ProvisionTenant", ({ variables }) => {
      const { input } = variables as ProvisionTenantMutationVariables;
      inputs.provisionTenant.push(input);
      return (
        fail("ProvisionTenant") ??
        HttpResponse.json({
          data: {
            provisionTenant: {
              org: {
                id: "org-tenant-new",
                name: input.name,
                parentId: "org-root",
                enabled: true,
                ownerUserId: "user-new-admin",
                visibility: "OWN",
                logoUrl: null,
              },
              ownerUserId: "user-new-admin",
              roleId: "role-copy",
              moduleKeys: input.moduleKeys,
            },
          },
        })
      );
    }),
    api.mutation("RevokeTenantProvision", ({ variables }) => {
      const { input } = variables as RevokeTenantProvisionMutationVariables;
      inputs.revokeTenantProvision.push(input);
      const org = orgOf(input.orgId);
      return (
        fail("RevokeTenantProvision") ??
        HttpResponse.json({
          data: {
            revokeTenantProvision: {
              success: true,
              revokedOrgId: input.orgId,
              revokedOwnerUserId: org?.ownerUserId ?? null,
              revokedRoleId: "role-copy",
            },
          },
        })
      );
    }),
    api.mutation("TransferOrgOwner", ({ variables }) => {
      const { input } = variables as TransferOrgOwnerMutationVariables;
      inputs.transferOrgOwner.push(input);
      return (
        fail("TransferOrgOwner") ??
        HttpResponse.json({
          data: {
            transferOrgOwner: {
              org: { id: input.orgId, ownerUserId: input.newOwnerUserId },
            },
          },
        })
      );
    }),
    api.mutation("SetOrgVisibility", ({ variables }) => {
      const { input } = variables as SetOrgVisibilityMutationVariables;
      inputs.setOrgVisibility.push(input);
      return (
        fail("SetOrgVisibility") ??
        HttpResponse.json({
          data: {
            setOrgVisibility: {
              org: { id: input.orgId, visibility: input.visibility },
            },
          },
        })
      );
    }),
    api.mutation("CreateUploadUrl", ({ variables }) => {
      const { input } = variables as CreateUploadUrlMutationVariables;
      inputs.createUploadUrl.push(input);
      const serial = String(inputs.createUploadUrl.length);
      return (
        fail("CreateUploadUrl") ??
        HttpResponse.json({
          data: {
            createUploadUrl: {
              uploadUrl: `${TEST_UPLOAD_ORIGIN}/signed/${serial}`,
              objectPath: `org-logos/${serial}.png`,
              expiresAt: "2026-09-19T00:10:00.000Z",
            },
          },
        })
      );
    }),
    http.put(`${TEST_UPLOAD_ORIGIN}/signed/*`, async ({ request }) => {
      const body = await request.arrayBuffer();
      uploadedFiles.push({
        url: request.url,
        contentType: request.headers.get("content-type"),
        size: body.byteLength,
      });
      return new HttpResponse(null, { status: 200 });
    }),
  ];

  return { handlers: handlers as OrgWorld["handlers"], inputs, uploadedFiles };
};
