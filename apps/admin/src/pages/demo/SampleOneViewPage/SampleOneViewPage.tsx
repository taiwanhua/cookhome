import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { CircularProgress } from "@repo/ui/circular-progress";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import { useSession } from "@/hooks/useSession";
import type { ModulePageProps } from "@/lib/module-tree";

import { DeleteItemDialog } from "../DeleteItemDialog";
import { SAMPLE_ONE_I18N, SAMPLE_ONE_QUERIES } from "../demo-sample-one-config";
import {
  type SampleOneErrorCode,
  sampleOneErrorOf,
} from "../demo-sample-one-error";
import { statusToneOf } from "../demo-sample-one-view";
import { useSampleOneAccess } from "../useSampleOneAccess";
import { AttachmentField } from "./AttachmentField";
import { ItemFieldRow } from "./ItemFieldRow";

// 模組層解構:具名 hook 呼叫(設定物件見 `demo-sample-one-config.ts`)
const { useItem, useDelete } = SAMPLE_ONE_QUERIES;

/**
 * 示範項目詳情(隱藏頁模組 `demo.sub.sample-one.view-page`;Figma 175:318)。
 *
 * 網址是 `/demo/sub/sample-one/view-page/<id>`,`<id>` 由殼的路由防守解出來傳進 `routeParam`
 * (`matchModuleRoute`);沒綁這個模組的人根本走不到這裡(殼會顯示無權限頁)。
 *
 * 三件事是這一頁要示範的:
 * - **內部備註**是欄位級權限欄:沒有 `show-internal-note` 時 api 連值都不給,
 *   前端**依自己的權限集決定要不要渲染這一列**,不要拿值去猜(值是 null 也可能只是沒填)。
 * - **封面走公開 bucket**:`coverUrl` 是穩定網址,直接放 `<img src>`。
 * - **附件走私有 bucket**:只有檔名,下載時才現簽(見 `AttachmentField`)。
 */
export const SampleOneViewPage = ({ routeParam }: ModulePageProps) => {
  const t = useTranslations(SAMPLE_ONE_I18N);
  const tFields = useTranslations(`${SAMPLE_ONE_I18N}.fields`);
  const tActions = useTranslations(`${SAMPLE_ONE_I18N}.actions`);
  const tErrors = useTranslations(`${SAMPLE_ONE_I18N}.errors`);
  const { session } = useSession();
  const navigate = useNavigate();
  const access = useSampleOneAccess();

  const itemId = routeParam ?? "";
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<SampleOneErrorCode | null>(
    null,
  );

  const query = useItem(session.client, { id: itemId }, { retry: false });
  const item = query.data?.demoItemOne.item ?? null;

  const goTo = (route: string | null, id?: string) => {
    if (route === null) {
      return;
    }
    void navigate(id === undefined ? route : `${route}/${id}`);
  };

  const deleteItem = useDelete(session.client, {
    onSuccess: () => {
      setIsDeleting(false);
      goTo(access.listRoute);
    },
    onError: (error: unknown) => {
      setActionError(sampleOneErrorOf(error).code);
    },
  });

  if (query.isLoading) {
    return <CircularProgress aria-label={t("loading")} />;
  }

  if (item === null) {
    return (
      <Alert severity="error">
        {tErrors(
          query.error === null
            ? "NOT_FOUND"
            : sampleOneErrorOf(query.error).code,
        )}
      </Alert>
    );
  }

  return (
    <Card sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 3, py: 2.5 }}>
      <Stack spacing={2.25}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Button
            variant="text"
            size="small"
            onClick={() => {
              goTo(access.listRoute);
            }}
          >
            {tActions("backToList")}
          </Button>
          <Box sx={{ flex: 1 }} />
          {item.abilities.canDelete && (
            <Button
              variant="text"
              color="error"
              onClick={() => {
                setActionError(null);
                setIsDeleting(true);
              }}
            >
              {tActions("delete")}
            </Button>
          )}
          {access.editRoute !== null && item.abilities.canEdit && (
            <Button
              onClick={() => {
                goTo(access.editRoute, item.id);
              }}
            >
              {tActions("edit")}
            </Button>
          )}
        </Stack>

        <Typography variant="h6" component="h1">
          {item.name}
        </Typography>

        <ItemFieldRow label={tFields("category")}>
          {item.categoryLabel ?? item.category ?? t("emptyValue")}
        </ItemFieldRow>
        <ItemFieldRow label={tFields("note")}>
          {item.note ?? t("emptyValue")}
        </ItemFieldRow>
        {/* 欄位級權限:沒有 `show-internal-note` 就整列不顯示(不是顯示空值) */}
        {access.canShowInternalNote && (
          <ItemFieldRow label={tFields("internalNote")}>
            {item.internalNote ?? t("emptyValue")}
          </ItemFieldRow>
        )}
        <ItemFieldRow label={tFields("status")}>
          <Tag
            tone={statusToneOf(item.status)}
            label={t(`status.${item.status}`)}
          />
        </ItemFieldRow>
        <ItemFieldRow label={tFields("enabled")}>
          <Tag
            tone={item.enabled ? "success" : "grey"}
            label={item.enabled ? t("enabled.true") : t("enabled.false")}
          />
        </ItemFieldRow>
        <ItemFieldRow label={tFields("cover")}>
          {item.coverUrl === null || item.coverUrl === undefined ? (
            t("emptyValue")
          ) : (
            // 封面框(Figma 177:509 的 160×100):圖直接吃公開 bucket 的穩定網址
            <Box
              sx={{
                width: 160,
                height: 100,
                borderRadius: 1,
                overflow: "hidden",
                bgcolor: "action.disabledBackground",
                "& img": {
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                },
              }}
            >
              <img
                src={item.coverUrl}
                alt={tFields("coverAlt", { name: item.name })}
              />
            </Box>
          )}
        </ItemFieldRow>
        <ItemFieldRow label={tFields("attachment")}>
          {item.attachment == null ? (
            t("emptyValue")
          ) : (
            <AttachmentField itemId={item.id} attachment={item.attachment} />
          )}
        </ItemFieldRow>
        {/* 建立者查不到那位使用者時 api 一律回 null(seed 示範資料用假 id)→ 顯示「—」 */}
        <ItemFieldRow label={tFields("createdBy")}>
          {item.createdBy?.name ?? t("emptyValue")}
        </ItemFieldRow>

        {actionError !== null && !isDeleting && (
          <Alert severity="error">{tErrors(actionError)}</Alert>
        )}
      </Stack>

      {isDeleting && (
        <DeleteItemDialog
          itemName={item.name}
          isSubmitting={deleteItem.isPending}
          errorCode={actionError}
          onCancel={() => {
            setActionError(null);
            setIsDeleting(false);
          }}
          onConfirm={() => {
            setActionError(null);
            deleteItem.mutate({ input: { id: item.id } });
          }}
        />
      )}
    </Card>
  );
};
