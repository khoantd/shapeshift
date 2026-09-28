import { Suspense } from "react";
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

export const metadata = {
  title: "Places — Shapeshift",
  description:
    "Search an address or place and explore it on the map (Google, MapTiler, SerpAPI, or OpenStreetMap tiles).",
};

export default function PlacesPage() {
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
            Loading places…
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
