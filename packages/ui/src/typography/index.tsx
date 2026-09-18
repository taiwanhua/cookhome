"use client";

import MuiTypography, {
  type TypographyProps as MuiTypographyProps,
} from "@mui/material/Typography";

export type TypographyProps = MuiTypographyProps;

export function Typography(props: Readonly<TypographyProps>) {
  return <MuiTypography {...props} />;
}
