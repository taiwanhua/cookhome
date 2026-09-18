"use client";

import MuiCollapse, {
  type CollapseProps as MuiCollapseProps,
} from "@mui/material/Collapse";

export type CollapseProps = MuiCollapseProps;

/** 展開 / 收合過場(側欄群組子項)。 */
export const Collapse = (props: CollapseProps) => <MuiCollapse {...props} />;
