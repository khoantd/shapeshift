import { WaitlistLanding } from "@/components/waitlist/WaitlistLanding";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Landing");
  return {
    title: t("headline"),
    description: t("subhead"),
    openGraph: {
      title: t("headline"),
      description: t("headline"),
      type: "website",
    },
  };
}

export default function Home() {
  return <WaitlistLanding />;
}
