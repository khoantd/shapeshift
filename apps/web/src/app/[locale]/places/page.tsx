import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteChrome } from "@/components/SiteChrome";
import { PlacesPageClient } from "@/components/places/PlacesPageClient";
import {
  getGoogleMapsPublicKey,
  getMapTilerPublicKey,
  missingPlacesConfigMessage,
  placesProviderConfigured,
  resolveMapTilesProvider,
  resolvePlacesProvider,
} from "@/lib/places/client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Places");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function PlacesPage() {
  const t = await getTranslations("Places");
  const provider = resolvePlacesProvider() ?? "google";
  const serverConfigured = placesProviderConfigured();
  const mapTiles = resolveMapTilesProvider(serverConfigured ? provider : null);
  const mapsApiKey =
    mapTiles === "maptiler"
      ? getMapTilerPublicKey()
      : mapTiles === "google"
        ? getGoogleMapsPublicKey()
        : "";
  const mapId = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "").trim();

  return (
    <>
      <Suspense
        fallback={
          <div className="mx-auto max-w-xl px-4 py-16 text-[15px] text-muted-foreground">
            {t("loading")}
          </div>
        }
      >
        <PlacesPageClient
          provider={provider}
          mapTiles={mapTiles}
          mapsApiKey={mapsApiKey}
          mapId={mapId}
          serverConfigured={serverConfigured}
          setupMessage={serverConfigured ? null : missingPlacesConfigMessage()}
        />
      </Suspense>
      <SiteChrome />
    </>
  );
}
