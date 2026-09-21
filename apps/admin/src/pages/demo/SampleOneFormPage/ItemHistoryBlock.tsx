import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { useSession } from "@/hooks/useSession";

import { SAMPLE_ONE_I18N, SAMPLE_ONE_QUERIES } from "../demo-sample-one-config";
import {
  changedFieldsOf,
  formatDateTime,
  historyActionKeyOf,
} from "../demo-sample-one-view";

// 模組層解構:具名 hook 呼叫(設定物件見 `demo-sample-one-config.ts`)
const { useHistory } = SAMPLE_ONE_QUERIES;

export interface ItemHistoryBlockProps {
  itemId: string;
}

/**
 * 變更歷程區塊(Figma 177:608)。**頁面自有權限的示範**:只在編輯頁出現,
 * 而且要持有編輯頁自己的 `edit-page.show-history` —— 與「能不能編輯」互相獨立。
 * 顯示與否由呼叫端判斷,所以這個元件一掛上就直接查。
 *
 * 內部備註在歷程裡一律是 `"[redacted]"`(api 不記內容),否則沒有 `show-internal-note`
 * 卻有這個區塊的人就能從歷程把它讀出來 —— 前端只照著顯示,不要自作聰明去「還原」。
 */
export const ItemHistoryBlock = ({ itemId }: ItemHistoryBlockProps) => {
  const t = useTranslations(`${SAMPLE_ONE_I18N}.history`);
  const tFields = useTranslations(`${SAMPLE_ONE_I18N}.fields`);
  const { session } = useSession();

  const history = useHistory(session.client, { id: itemId });
  const entries = history.data?.demoItemOneHistory.items ?? [];

  return (
    <Box
      component="section"
      aria-label={t("region")}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        px: 1.75,
        py: 1.5,
      }}
    >
      <Stack spacing={1}>
        <Typography variant="subtitle2">{t("title")}</Typography>
        {entries.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            {history.isLoading ? t("loading") : t("empty")}
          </Typography>
        ) : (
          entries.map((entry) => {
            const fields = changedFieldsOf(entry.after)
              .map((field) => (tFields.has(field) ? tFields(field) : field))
              .join("、");
            return (
              <Typography
                key={entry.id}
                variant="caption"
                color="text.secondary"
                component="p"
              >
                {t("entry", {
                  at: formatDateTime(entry.createdAt),
                  actor: entry.actor?.name ?? t("unknownActor"),
                  action: t(`actions.${historyActionKeyOf(entry.action)}`),
                  fields,
                })}
              </Typography>
            );
          })
        )}
      </Stack>
    </Box>
  );
};
