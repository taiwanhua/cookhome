"use client";

import MuiStack, {
  type StackProps as MuiStackProps,
} from "@mui/material/Stack";

export type StackProps = MuiStackProps;

export const Stack = (props: StackProps) => <MuiStack {...props} />;
