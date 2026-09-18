import "./styles.css";

import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AppProviders } from "../../components/AppProviders";
import { routing } from "../../i18n/routing";
import { enableStaticRendering } from "../../i18n/set-request-locale";

export interface RootLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export const generateStaticParams = () =>
  routing.locales.map((locale) => ({ locale }));

export const generateMetadata = async ({
  params,
}: Pick<RootLayoutProps, "params">) => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "front.meta" });

  return {
    title: {
      default: t("title"),
      template: t("titleTemplate"),
    },
    description: t("description"),
  };
};

const RootLayout = async ({ children, params }: RootLayoutProps) => {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  enableStaticRendering(locale);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;
