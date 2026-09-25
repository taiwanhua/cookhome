import { useTranslations } from "use-intl";

import { useModuleListColumnsQuery } from "@repo/graphql";
import { CircularProgress } from "@repo/ui/circular-progress";
import { Dialog } from "@repo/ui/dialog";

import { useSession } from "@/hooks/useSession";

import { ListColumnsEditor } from "./ListColumnsEditor";

export interface ListColumnsDialogProps {
  moduleKey: string;
  moduleName: string;
  onClose: () => void;
}

/**
 * 模組與權限 → 列表欄位配置(Spec 6a §8 畫面 6;root)。外層 gate:目前的配置讀到了才掛編輯器
 * (初始值只取一次,REACT-08)。
 */
export const ListColumnsDialog = ({
  moduleKey,
  moduleName,
  onClose,
}: ListColumnsDialogProps) => {
  const t = useTranslations("admin.moduleManager.listColumns");
  const { session } = useSession();
  const query = useModuleListColumnsQuery(session.client, { moduleKey });
  const columns = query.data?.moduleListColumns.columns;

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="md"
      title={t("title", { name: moduleName })}
    >
      {columns === undefined ? (
        <CircularProgress aria-label={t("loading")} />
      ) : (
        <ListColumnsEditor
          moduleKey={moduleKey}
          initial={columns}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
};
