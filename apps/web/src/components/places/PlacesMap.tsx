"use client";

import dynamic from "next/dynamic";
import type {
  MapTilesProvider,
  PlaceDetails,
  PlacePrediction,
  PlacesProvider,
} from "@/lib/places/types";
import type { UserCoords } from "@/lib/places/useUserLocation";
import { GooglePlacesMap } from "./GooglePlacesMap";
import { MapTilerPlacesMap } from "./MapTilerPlacesMap";

const OsmPlacesMap = dynamic(
  () => import("./OsmPlacesMap").then((m) => m.OsmPlacesMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-full min-h-[45vh] w-full bg-muted/40"
        aria-hidden
      />
    ),
  },
);

type MarkerAccent = "default" | "pinned";

type PlacesMapProps = {
  /** Search/geocode provider (drives copy); map tiles may differ for SerpAPI. */
  provider: PlacesProvider;
  mapTiles: MapTilesProvider | null;
  apiKey: string;
  mapId?: string;
  place: PlaceDetails | null;
  /** Optional search hits with coordinates (OSM map plots them). */
  predictions?: PlacePrediction[];
  userLocation?: UserCoords | null;
  locateRequestId?: number;
  /** Called when the user clicks a prediction pin on the OSM map. */
  onSelectPrediction?: (prediction: PlacePrediction) => void;
  /** Brand-colored markers when listing `/pinned` on OSM. */
  markerAccent?: MarkerAccent;
};

export function PlacesMap({
  mapTiles,
  apiKey,
  mapId,
  place,
  predictions = [],
  userLocation = null,
  locateRequestId = 0,
  onSelectPrediction,
  markerAccent = "default",
}: PlacesMapProps) {
  if (mapTiles === "maptiler") {
    return (
      <MapTilerPlacesMap
        apiKey={apiKey}
        place={place}
        userLocation={userLocation}
        locateRequestId={locateRequestId}
      />
    );
  }
  if (mapTiles === "google") {
    return (
      <GooglePlacesMap
        apiKey={apiKey}
        mapId={mapId}
        place={place}
        userLocation={userLocation}
        locateRequestId={locateRequestId}
      />
    );
  }
  return (
    <OsmPlacesMap
      place={place}
      predictions={predictions}
      userLocation={userLocation}
      locateRequestId={locateRequestId}
      onSelectPrediction={onSelectPrediction}
      markerAccent={markerAccent}
    />
  );
}
