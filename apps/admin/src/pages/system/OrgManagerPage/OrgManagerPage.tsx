import { useState } from "react";

import { useDeleteOrgMutation, useSetOrgEnabledMutation } from "@repo/graphql";
import { Stack } from "@repo/ui/stack";

import { useSession } from "@/hooks/useSession";
import { orgTrail } from "@/lib/org-tree";

import { CreateChildOrgDialog } from "./CreateChildOrgDialog";
import { DeleteOrgDialog } from "./DeleteOrgDialog";
import { EditOrgDialog } from "./EditOrgDialog/EditOrgDialog";
import { OrgDetailPanel } from "./OrgDetailPanel/OrgDetailPanel";
import { OrgTreePanel } from "./OrgTreePanel";
import { ProvisionTenantDialog } from "./ProvisionTenantDialog/ProvisionTenantDialog";
import { ToggleEnabledDialog } from "./ToggleEnabledDialog";
import { type OrgManagerError, orgManagerErrorOf } from "./org-manager-error";
import { useMoveTargets } from "./useMoveTargets";
import { useOrgManagerData } from "./useOrgManagerData";
import { isTenantTop, useTenantOwner } from "./useTenantOwner";

/** 同時只會開一個彈窗;用一個標籤而不是五個布林,避免出現「兩個都開著」的狀態。 */
type OpenDialog =
  "createChild" | "edit" | "toggleEnabled" | "delete" | "provision" | null;

/**
 * 組織管理(模組 key `system.org-manager`,正本 `docs/modules/org-manager.md`;
 * Figma「Screen / Admin 組織管理」根組織視角 87:3、租戶視角 92:694)。
 *
 * 左樹選組織 → 右側顯示該組織的資料與可用動作;所有動作都是這一頁上的彈窗。
 * **兩種視角不是兩套頁**:樹根是誰(根組織 / 租戶頂層)與手上有沒有 `tenant-ops` 那三筆權限,
 * 已經足以決定畫面,不需要「我是不是超級管理員」這種旗標。
 */
export const OrgManagerPage = () => {
  const { session } = useSession();
  const data = useOrgManagerData();
  const owner = useTenantOwner(data.org);
  const moveTargets = useMoveTargets({
    nodes: data.orgNodes,
    isRootPerspective: data.isRootPerspective,
    orgId: data.selectedOrgId,
  });

  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [actionError, setActionError] = useState<OrgManagerError | null>(null);

  const closeDialog = () => {
    setOpenDialog(null);
    setActionError(null);
  };

  const onActionError = (error: unknown) => {
    setActionError(orgManagerErrorOf(error));
  };

  const setOrgEnabled = useSetOrgEnabledMutation(session.client, {
    onSuccess: (payload) => {
      closeDialog();
      void data.invalidate(payload.setOrgEnabled.org.id);
    },
    onError: onActionError,
  });

  const deleteOrg = useDeleteOrgMutation(session.client, {
    onSuccess: () => {
      closeDialog();
      data.selectOrg(null);
      void data.invalidate();
    },
    onError: onActionError,
  });

  /**
   * 租戶頂層對租戶內的人:停用 / 刪除 / 搬移只有根組織能做(ADR-0009)。
   * api 也會擋(`assertTenantTopOperableBy`);這裡只是讓人先看得出來。
   */
  const isTenantTopProtected = isTenantTop(data.org) && !data.isRootPerspective;

  const trail = orgTrail(data.orgNodes, data.selectedOrgId ?? "");
  const parentName = trail.length > 1 ? (trail.at(-2)?.name ?? null) : null;
  const selectedNode = trail.at(-1);
  const isSelectionActionable =
    selectedNode !== undefined && !selectedNode.outOfScope;

  return (
    <Stack direction="row" spacing={3} sx={{ alignItems: "flex-start" }}>
      <OrgTreePanel
        nodes={data.orgNodes}
        isLoading={data.isOrgTreeLoading}
        isRootPerspective={data.isRootPerspective}
        selectedOrgId={data.selectedOrgId}
        onSelectOrg={data.selectOrg}
        canProvision={data.ability.canProvision}
        canCreateChild={data.ability.canCreateChild}
        isCreateChildEnabled={isSelectionActionable}
        onProvision={() => {
          setOpenDialog("provision");
        }}
        onCreateChild={() => {
          setOpenDialog("createChild");
        }}
      />

      <OrgDetailPanel
        org={data.org}
        isLoading={data.isOrgLoading}
        parentName={parentName}
        ownerName={owner.ownerName}
        hasOwner={isTenantTop(data.org)}
        ability={data.ability}
        isTenantTopProtected={isTenantTopProtected}
        onEdit={() => {
          setOpenDialog("edit");
        }}
        onToggleEnabled={() => {
          setActionError(null);
          setOpenDialog("toggleEnabled");
        }}
        onDelete={() => {
          setActionError(null);
          setOpenDialog("delete");
        }}
      />

      {openDialog === "createChild" && data.selectedOrgId !== null && (
        <CreateChildOrgDialog
          parentId={data.selectedOrgId}
          parentName={data.org?.name ?? ""}
          onClose={closeDialog}
          onCreated={(orgId) => {
            closeDialog();
            void data.invalidate(orgId);
          }}
        />
      )}

      {openDialog === "edit" && data.org !== undefined && (
        <EditOrgDialog
          org={data.org}
          parentOptions={moveTargets}
          isTenantTop={isTenantTop(data.org)}
          isTenantTopProtected={isTenantTopProtected}
          ownerCandidates={owner.candidates}
          ability={data.ability}
          onClose={closeDialog}
          onSaved={() => {
            const orgId = data.org?.id;
            closeDialog();
            void data.invalidate(orgId);
          }}
        />
      )}

      {openDialog === "toggleEnabled" && data.org !== undefined && (
        <ToggleEnabledDialog
          org={data.org}
          isSubmitting={setOrgEnabled.isPending}
          errorCode={actionError?.code ?? null}
          onCancel={closeDialog}
          onConfirm={() => {
            setActionError(null);
            setOrgEnabled.mutate({
              input: {
                id: data.org?.id ?? "",
                enabled: !(data.org?.enabled ?? false),
              },
            });
          }}
        />
      )}

      {openDialog === "delete" && data.org !== undefined && (
        <DeleteOrgDialog
          org={data.org}
          isSubmitting={deleteOrg.isPending}
          errorCode={actionError?.code ?? null}
          reasons={actionError?.reasons ?? []}
          onCancel={closeDialog}
          onConfirm={() => {
            setActionError(null);
            deleteOrg.mutate({ input: { id: data.org?.id ?? "" } });
          }}
        />
      )}

      {openDialog === "provision" && (
        <ProvisionTenantDialog
          onClose={closeDialog}
          onProvisioned={(orgId) => {
            closeDialog();
            void data.invalidate(orgId);
          }}
        />
      )}
    </Stack>
  );
};
