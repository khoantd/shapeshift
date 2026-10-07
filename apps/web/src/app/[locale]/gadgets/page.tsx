import { ShapeshiftApp } from "@/components/ShapeshiftApp";
import { SiteChrome } from "@/components/SiteChrome";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Gadgets");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function GadgetsPage() {
  return (
    <>
      <ShapeshiftApp showGadgetShelf />
      <SiteChrome />
    </>
  );
}
