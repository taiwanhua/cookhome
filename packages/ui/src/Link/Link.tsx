import type { AnchorHTMLAttributes, ReactNode } from "react";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
  newTab?: boolean;
  href: string;
}

export const Link = ({ children, href, newTab, ...other }: LinkProps) => (
  <a
    href={href}
    rel={newTab ? "noreferrer" : undefined}
    target={newTab ? "_blank" : undefined}
    {...other}
  >
    {children}
  </a>
);
