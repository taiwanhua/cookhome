import { useState } from "react";

import { OrgVisibility } from "@repo/graphql";

import type { OrgDetail } from "../org-manager-types";

export interface EditOrgFormState {
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  /** 新的上層組織(搬移);沒改就等於原本的 `parentId` */
  parentId: string;
  setParentId: (value: string) => void;
  /** 新選的商標檔案;null = 這次不換商標 */
  logoFile: File | null;
  setLogoFile: (file: File | null) => void;
  ownerUserId: string;
  setOwnerUserId: (value: string) => void;
  visibility: OrgVisibility;
  setVisibility: (value: OrgVisibility) => void;
  isValid: boolean;
  /** 四個 mutation 各自要不要送(沒變動的欄位不送,api 也不會留空的審計紀錄) */
  changes: {
    hasProfileChange: boolean;
    hasMove: boolean;
    hasOwnerChange: boolean;
    hasVisibilityChange: boolean;
  };
}

/**
 * 編輯組織表單(Figma 88:168)。彈窗關閉即卸載,初始值在掛載時從 props 進 `useState`,
 * 不用 effect 同步(REACT-06)。
 *
 * 四個欄位群各自對到**不同的 mutation**:名稱 / 描述 / 商標 → `updateOrg`、上層組織 →
 * `moveOrg`、擁有者 → `transferOrgOwner`、可見範圍 → `setOrgVisibility`。
 * 這不是前端的湊合:`UpdateOrgInput` 根本沒有後三者的欄位(`docs/modules/org-manager.md`),
 * 所以「哪些變了」要在這裡算出來,送出時才知道要打哪幾個。
 */
export const useEditOrgForm = (org: OrgDetail): EditOrgFormState => {
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [parentId, setParentId] = useState(org.parentId ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [ownerUserId, setOwnerUserId] = useState(org.ownerUserId ?? "");
  const [visibility, setVisibility] = useState(
    org.visibility ?? OrgVisibility.Own,
  );

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  return {
    name,
    setName,
    description,
    setDescription,
    parentId,
    setParentId,
    logoFile,
    setLogoFile,
    ownerUserId,
    setOwnerUserId,
    visibility,
    setVisibility,
    isValid: trimmedName !== "",
    changes: {
      hasProfileChange:
        trimmedName !== org.name ||
        trimmedDescription !== (org.description ?? "") ||
        logoFile !== null,
      hasMove: parentId !== "" && parentId !== (org.parentId ?? ""),
      hasOwnerChange:
        ownerUserId !== "" && ownerUserId !== (org.ownerUserId ?? ""),
      hasVisibilityChange:
        org.visibility !== null && visibility !== org.visibility,
    },
  };
};
