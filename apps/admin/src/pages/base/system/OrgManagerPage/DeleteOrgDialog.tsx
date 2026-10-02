import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type {
  OrgManagerErrorCode,
  OrgNotDeletableReason,
} from "./org-manager-error";
import type { OrgDetail } from "./org-manager-types";

export interface DeleteOrgDialogProps {
  org: OrgDetail;
  isSubmitting: boolean;
  errorCode: OrgManagerErrorCode | null;
  /** `ORG_NOT_DELETABLE` 時 api 逐項回報為什麼不能刪 */
  reasons: readonly OrgNotDeletableReason[];
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 刪除確認。前置檢查在 api(無子組織 / 無成員 / 不是角色的擁有組織 / 無業務資料 / 非根組織),
 * 前端不預判 — 送出後收到 `ORG_NOT_DELETABLE` 才把 `reasons` 攤成清單,並提示改用停用
 * (`docs/modules/org-manager.md`「刪除」)。
 */
export const DeleteOrgDialog = ({
  org,
  isSubmitting,
  errorCode,
  reasons,
  onCancel,
  onConfirm,
}: DeleteOrgDialogProps) => {
  const t = useTranslations("admin.orgManager.delete");
  const tForm = useTranslations("admin.orgManager.form");
  const tErrors = useTranslations("admin.orgManager.errors");
  const isBlocked = reasons.length > 0;

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      title={t("title", { name: org.name })}
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            {isBlocked ? t("close") : tForm("cancel")}
          </Button>
          {!isBlocked && (
            <Button color="error" disabled={isSubmitting} onClick={onConfirm}>
              {t("confirm")}
            </Button>
          )}
        </>
      }
    >
      <Stack spacing={2}>
        {isBlocked ? (
          <>
            <Typography variant="body2">{t("blocked")}</Typography>
            <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 3 }}>
              {reasons.map((reason) => (
                <Typography key={reason} component="li" variant="body2">
                  {t(`reasons.${reason}`)}
                </Typography>
              ))}
            </Stack>
            <Alert severity="info">{t("useDisableInstead")}</Alert>
          </>
        ) : (
          <Typography variant="body2">{t("body")}</Typography>
        )}
        {errorCode !== null && !isBlocked && (
          <Alert severity="error">{tErrors(errorCode)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
