import { Badge } from "@repo/ui/badge";
import { Box } from "@repo/ui/box";

export interface ApplyCenterTabLabelProps {
  text: string;
  /** 頁籤右側的數字;0 不顯示,超過 99 顯示 `99+` */
  count: number;
  /** 「待我審核」用主色(要我動手的事)、「我的申請」用灰底 */
  color: "primary" | "default";
}

/** 申請中心頁籤的文字 + 右側數字徽章。 */
export const ApplyCenterTabLabel = ({
  text,
  count,
  color,
}: ApplyCenterTabLabelProps) => (
  <Box
    component="span"
    sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
  >
    {text}
    <Badge badgeContent={count} color={color} />
  </Box>
);
