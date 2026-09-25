import { useState } from "react";
import { useTranslations } from "use-intl";

import type { LayoutSection } from "@repo/domain/form";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { Radio, RadioGroup } from "@repo/ui/radio";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type { RemoveSectionMode } from "@/lib/form-engine/designer-ops";

export interface DeleteSectionDialogProps {
  section: LayoutSection;
  onCancel: () => void;
  onConfirm: (mode: RemoveSectionMode) => void;
}

/** 刪分區二選一(Spec 6a §8):欄位移到「未放置」區,或連同欄位一起刪除(只動草稿)。 */
export const DeleteSectionDialog = ({
  section,
  onCancel,
  onConfirm,
}: DeleteSectionDialogProps) => {
  const t = useTranslations("admin.forms.deleteSection");
  const [mode, setMode] = useState<RemoveSectionMode>("unplace");

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      title={t("title", { title: section.title })}
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            color="error"
            onClick={() => {
              onConfirm(mode);
            }}
          >
            {t("confirm")}
          </Button>
        </>
      }
    >
      <Stack spacing={1}>
        <Typography variant="body2">{t("body")}</Typography>
        <RadioGroup
          aria-label={t("mode")}
          value={mode}
          onChange={(_event, next) => {
            setMode(next === "withFields" ? "withFields" : "unplace");
          }}
        >
          <FormControlLabel
            value="unplace"
            control={<Radio />}
            label={t("unplace")}
          />
          <FormControlLabel
            value="withFields"
            control={<Radio />}
            label={t("withFields")}
          />
        </RadioGroup>
      </Stack>
    </Dialog>
  );
};
