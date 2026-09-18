"use client";

import MuiSwitch, {
  type SwitchProps as MuiSwitchProps,
} from "@mui/material/Switch";

import { mergeSx } from "../theme/sx";

/** 幾何照 Figma Draft/Switch 88:216:軌道 40×22(全圓角)、把手直徑 16、內縮 3。 */
const TRACK_WIDTH = 40;
const TRACK_HEIGHT = 22;
const THUMB_SIZE = 16;
const THUMB_INSET = 3;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2;

export type SwitchProps = MuiSwitchProps;

/**
 * 開關(Figma Components / Switch 88:211 的 Draft/Switch 88:216;模組啟用等 runtime 切換)。
 * MUI 預設的軌道比 Figma 窄且把手外凸,所以幾何整組覆寫;顏色仍走語意 token。
 */
export const Switch = ({ sx, ...rest }: SwitchProps) => (
  <MuiSwitch
    sx={mergeSx(
      {
        width: TRACK_WIDTH,
        height: TRACK_HEIGHT,
        padding: 0,
        display: "flex",
        "& .MuiSwitch-switchBase": {
          padding: `${String(THUMB_INSET)}px`,
          "&.Mui-checked": {
            transform: `translateX(${String(THUMB_TRAVEL)}px)`,
            color: "common.white",
            "& + .MuiSwitch-track": {
              backgroundColor: "primary.main",
              opacity: 1,
            },
          },
        },
        "& .MuiSwitch-thumb": {
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          boxShadow: "none",
          color: "common.white",
        },
        "& .MuiSwitch-track": {
          borderRadius: `${String(TRACK_HEIGHT / 2)}px`,
          backgroundColor: "grey.400",
          opacity: 1,
        },
      },
      sx,
    )}
    {...rest}
  />
);
