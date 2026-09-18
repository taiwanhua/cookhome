"use client";

import MuiCard, { type CardProps as MuiCardProps } from "@mui/material/Card";

export type CardProps = MuiCardProps;

export const Card = (props: CardProps) => <MuiCard {...props} />;
