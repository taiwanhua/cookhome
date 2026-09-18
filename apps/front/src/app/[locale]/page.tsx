import { HomeView } from "../../components/HomeView/HomeView";
import { enableStaticRendering } from "../../i18n/set-request-locale";

export const revalidate = 60;

export interface HomePageProps {
  params: Promise<{ locale: string }>;
}

const HomePage = async ({ params }: HomePageProps) => {
  const { locale } = await params;
  enableStaticRendering(locale);

  return <HomeView />;
};

export default HomePage;
