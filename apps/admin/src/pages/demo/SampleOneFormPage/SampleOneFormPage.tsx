import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Card } from "@repo/ui/card";
import { CircularProgress } from "@repo/ui/circular-progress";

import { useSession } from "@/hooks/useSession";
import type { ModulePageProps } from "@/lib/module-tree";

import {
  SAMPLE_ONE_I18N,
  SAMPLE_ONE_MODULE_KEYS,
  SAMPLE_ONE_QUERIES,
} from "../demo-sample-one-config";
import { sampleOneErrorOf } from "../demo-sample-one-error";
import { useDemoCategoryOptions } from "../useDemoCategoryOptions";
import { useSampleOneAccess } from "../useSampleOneAccess";
import { SampleOneForm } from "./SampleOneForm";
import { internalNoteModeOf } from "./sample-one-form";

// 模組層解構:具名 hook 呼叫(設定物件見 `demo-sample-one-config.ts`)
const { useItem } = SAMPLE_ONE_QUERIES;

/**
 * 新增 / 編輯示範項目(隱藏頁模組 `create-page` / `edit-page`,**共版型**;Figma 175:558)。
 *
 * 兩個模組 key 都登記到這一個元件,情境由 `module.key` 判斷 —— 這正是票上要示範的
 * 「同一份版型兩種情境」。編輯情境的 `<id>` 由殼的路由防守解出來傳進 `routeParam`。
 *
 * 這一層只做 gate:編輯要先把那一筆取回來,資料到了才掛表單(表單的初始值只取一次,REACT-08)。
 */
export const SampleOneFormPage = ({ module, routeParam }: ModulePageProps) => {
  const t = useTranslations(SAMPLE_ONE_I18N);
  const tErrors = useTranslations(`${SAMPLE_ONE_I18N}.errors`);
  const { session } = useSession();
  const navigate = useNavigate();
  const access = useSampleOneAccess();
  const categories = useDemoCategoryOptions();

  const isEdit = module.key === SAMPLE_ONE_MODULE_KEYS.editPage;
  const itemId = routeParam ?? "";

  const query = useItem(
    session.client,
    { id: itemId },
    { enabled: isEdit && itemId !== "", retry: false },
  );
  const item = query.data?.demoItemOne.item ?? null;

  const leave = () => {
    if (access.listRoute !== null) {
      void navigate(access.listRoute);
    }
  };

  if (isEdit && query.isLoading) {
    return <CircularProgress aria-label={t("loading")} />;
  }

  if (isEdit && item === null) {
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
      <SampleOneForm
        item={item}
        categoryOptions={categories.options}
        isCategoryAvailable={categories.isAvailable}
        internalNoteMode={internalNoteModeOf(
          access.canShowInternalNote,
          // 新增看自己的權限;編輯看 api 逐筆算好的 `abilities`(不要兩邊各算一次)
          item === null
            ? access.canEditInternalNote
            : item.abilities.canEditInternalNote,
        )}
        showTips={!isEdit && access.canShowTips}
        showHistory={isEdit && access.canShowHistory}
        onLeave={leave}
      />
    </Card>
  );
};
