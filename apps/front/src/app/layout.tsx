import "./styles.css";

import { Providers } from "./providers";

export const metadata = {
  title: {
    default: "CookHome — 家常食譜",
    template: "%s | CookHome",
  },
  description: "分享與收藏家常食譜的網站",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
