"use client";

import MuiCard, { type CardProps as MuiCardProps } from "@mui/material/Card";

export type CardProps = MuiCardProps;

export function Card(props: Readonly<CardProps>) {
  return <MuiCard {...props} />;
}
