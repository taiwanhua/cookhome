import { useState } from "react";
import { useTranslations } from "use-intl";

import { useAttachmentDownloadUrlQuery } from "@repo/graphql";
import { Button } from "@repo/ui/button";
import { Link } from "@repo/ui/link";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { useSession } from "@/hooks/useSession";

import { SAMPLE_ONE_I18N } from "../demo-sample-one-config";
import type { DemoItemDetail } from "../demo-sample-one-types";

export interface AttachmentFieldProps {
  itemId: string;
  attachment: NonNullable<DemoItemDetail["attachment"]>;
}

/**
 * 附件欄(Figma 177:511):檔名 + 下載。
 *
 * 附件在**私有** bucket(ADR-0010 的雙路),清單與單筆都只給 `{ path, name }`;
 * **按下「下載」才呼叫 `AttachmentDownloadUrl` 現簽**一條短效網址 —— 預先取來放著等於
 * 把短效簽名當成穩定連結用,一頁開著沒動就過期了。
 *
 * 現簽回來之後給的是一條**連結**而不是直接開新分頁:短效網址的語意要對使用者可見
 * (連結上寫明「短效」),而且瀏覽器擋彈出視窗時不會什麼事都沒發生。
 */
export const AttachmentField = ({
  itemId,
  attachment,
}: AttachmentFieldProps) => {
  const t = useTranslations(`${SAMPLE_ONE_I18N}.attachment`);
  const { session } = useSession();
  const [isRequested, setIsRequested] = useState(false);

  const download = useAttachmentDownloadUrlQuery(
    session.client,
    { id: itemId },
    { enabled: isRequested, gcTime: 0 },
  );
  const url = download.data?.attachmentDownloadUrl.url ?? null;

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Typography variant="body2">{attachment.name}</Typography>
      {url === null ? (
        <Button
          variant="text"
          size="small"
          disabled={isRequested && download.isFetching}
          onClick={() => {
            setIsRequested(true);
          }}
        >
          {t("download")}
        </Button>
      ) : (
        <Link href={url} newTab>
          {t("open")}
        </Link>
      )}
      <Typography variant="caption" color="text.secondary">
        {t("hint")}
      </Typography>
    </Stack>
  );
};
