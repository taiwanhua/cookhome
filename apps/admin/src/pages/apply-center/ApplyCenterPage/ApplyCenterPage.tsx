import { useState } from "react";
import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Stack } from "@repo/ui/stack";
import { Tabs } from "@repo/ui/tabs";

import { useApplicableForms } from "@/hooks/useApplicableForms";

import { MyApplicationsTab } from "./MyApplicationsTab";
import { MyTasksTab } from "./MyTasksTab";
import { NewApplicationDialog } from "./NewApplicationDialog";

type ApplyCenterTab = "mine" | "tasks";

/**
 * 申請中心(固定模組 `apply-center`,Spec 6b §8 畫面 8;正本 docs/modules/workflows.md「申請中心」):
 * 兩個**跨模組**的頁籤 —— 「我的申請」「待我審核」;右上「新申請」選模組 → 選表單 → 進該模組的新增頁。
 * 內容以「我」為邊界(我送的、派給我的),不套可見範圍與資料範圍。
 */
export const ApplyCenterPage = () => {
  const t = useTranslations("admin.applyCenter");
  const { modules } = useApplicableForms();
  const [tab, setTab] = useState<ApplyCenterTab>("mine");
  const [isCreating, setIsCreating] = useState(false);

  return (
    <Card
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        px: 3,
        py: 2,
      }}
    >
      <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Box sx={{ flex: 1 }}>
            <Tabs
              aria-label={t("tabs")}
              value={tab}
              onChange={(next) => {
                setTab(next === "tasks" ? "tasks" : "mine");
              }}
              items={[
                { value: "mine", label: t("tabMine") },
                { value: "tasks", label: t("tabTasks") },
              ]}
            />
          </Box>
          <Button
            disabled={modules.length === 0}
            onClick={() => {
              setIsCreating(true);
            }}
          >
            {t("newApplication.open")}
          </Button>
        </Stack>
        {tab === "mine" ? (
          <MyApplicationsTab modules={modules} />
        ) : (
          <MyTasksTab modules={modules} />
        )}
      </Stack>
      {isCreating && (
        <NewApplicationDialog
          modules={modules}
          onClose={() => {
            setIsCreating(false);
          }}
        />
      )}
    </Card>
  );
};
