"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, type MutableRefObject } from "react";
import type {
  Circle,
  CircleMarker,
  LatLngExpression,
  LatLngBoundsExpression,
  Map as LeafletMap,
  Marker,
} from "leaflet";
import type { PlaceDetails, PlacePrediction } from "@/lib/places/types";
import type { UserCoords } from "@/lib/places/useUserLocation";

const DEFAULT_CENTER: LatLngExpression = [20, 0];
const DEFAULT_ZOOM = 2;
const SELECTED_ZOOM = 15;
const USER_ZOOM = 14;

const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

type OsmPlacesMapProps = {
  place: PlaceDetails | null;
  predictions?: PlacePrediction[];
  userLocation?: UserCoords | null;
  /** When this counter changes, pan to the user location (locate button). */
  locateRequestId?: number;
  onSelectPrediction?: (prediction: PlacePrediction) => void;
};

type LeafletNS = typeof import("leaflet");

/** Google Maps–style teardrop pin (tip at bottom center). */
function teardropIconHtml(color: string, size: "sm" | "lg"): string {
  const w = size === "lg" ? 28 : 22;
  const h = size === "lg" ? 40 : 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 28 40" aria-hidden="true">
  <path fill="${color}" stroke="#fff" stroke-width="1.5" d="M14 1.5c-6.35 0-11.5 5.15-11.5 11.5 0 8.6 11.5 25 11.5 25S25.5 21.6 25.5 13C25.5 6.65 20.35 1.5 14 1.5z"/>
  <circle cx="14" cy="13" r="4.5" fill="#fff"/>
</svg>`;
}

function pinIcon(L: LeafletNS, color: string, size: "sm" | "lg") {
  const w = size === "lg" ? 28 : 22;
  const h = size === "lg" ? 40 : 32;
  return L.divIcon({
    className: "ss-places-pin",
    html: teardropIconHtml(color, size),
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    tooltipAnchor: [0, -h + 8],
  });
}

function syncSelectedMarker(
  L: LeafletNS,
  map: LeafletMap,
  markerRef: MutableRefObject<Marker | null>,
  place: PlaceDetails | null,
) {
  if (!place) {
    markerRef.current?.remove();
    markerRef.current = null;
    return;
  }

  const latLng: LatLngExpression = [place.lat, place.lng];
  map.setView(latLng, SELECTED_ZOOM);
  const icon = pinIcon(L, "#ea4335", "lg");
  if (!markerRef.current) {
    markerRef.current = L.marker(latLng, { icon, zIndexOffset: 600 })
      .bindTooltip(place.name, { permanent: false, direction: "top" })
      .addTo(map);
  } else {
    markerRef.current.setLatLng(latLng);
    markerRef.current.setIcon(icon);
    markerRef.current.setTooltipContent(place.name);
  }
}

function syncPredictionMarkers(
  L: LeafletNS,
  map: LeafletMap,
  layerRef: MutableRefObject<Marker[]>,
  predictions: PlacePrediction[],
  selectedId: string | null,
  onSelect?: (prediction: PlacePrediction) => void,
  userLocation?: UserCoords | null,
) {
  for (const m of layerRef.current) m.remove();
  layerRef.current = [];

  const withCoords = predictions.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      p.placeId !== selectedId,
  );
  if (!withCoords.length) return;

  const icon = pinIcon(L, "#ea4335", "sm");
  const points: LatLngExpression[] = [];
  for (const p of withCoords) {
    const latLng: LatLngExpression = [p.lat!, p.lng!];
    points.push(latLng);
    const marker = L.marker(latLng, { icon, opacity: 0.85, zIndexOffset: 200 })
      .bindTooltip(p.mainText, { permanent: false, direction: "top" })
      .addTo(map);
    if (onSelect) {
      marker.on("click", () => onSelect(p));
    }
    layerRef.current.push(marker);
  }

  if (!selectedId && points.length > 0) {
    if (
      userLocation &&
      Number.isFinite(userLocation.lat) &&
      Number.isFinite(userLocation.lng)
    ) {
      points.push([userLocation.lat, userLocation.lng]);
    }
    if (points.length === 1) {
      map.setView(points[0]!, 14);
    } else {
      const bounds: LatLngBoundsExpression = points as [number, number][];
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }
}

function syncUserLocation(
  L: LeafletNS,
  map: LeafletMap,
  markerRef: MutableRefObject<CircleMarker | null>,
  accuracyRef: MutableRefObject<Circle | null>,
  userLocation: UserCoords | null | undefined,
  opts: { pan: boolean },
) {
  if (!userLocation) {
    markerRef.current?.remove();
    markerRef.current = null;
    accuracyRef.current?.remove();
    accuracyRef.current = null;
    return;
  }

  const latLng: LatLngExpression = [userLocation.lat, userLocation.lng];
  const accuracy =
    Number.isFinite(userLocation.accuracy) && (userLocation.accuracy ?? 0) > 0
      ? Math.min(userLocation.accuracy!, 500)
      : 40;

  if (!accuracyRef.current) {
    accuracyRef.current = L.circle(latLng, {
      radius: accuracy,
      color: "#2563eb",
      weight: 1,
      fillColor: "#3b82f6",
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(map);
  } else {
    accuracyRef.current.setLatLng(latLng);
    accuracyRef.current.setRadius(accuracy);
  }

  if (!markerRef.current) {
    markerRef.current = L.circleMarker(latLng, {
      radius: 8,
      color: "#1d4ed8",
      weight: 3,
      fillColor: "#3b82f6",
      fillOpacity: 1,
    })
      .bindTooltip("You are here", { permanent: false, direction: "top" })
      .addTo(map);
  } else {
    markerRef.current.setLatLng(latLng);
  }

  if (opts.pan) {
    map.setView(latLng, USER_ZOOM);
  }
}

export function OsmPlacesMap({
  place,
  predictions = [],
  userLocation = null,
  locateRequestId = 0,
  onSelectPrediction,
}: OsmPlacesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const predictionMarkersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<CircleMarker | null>(null);
  const userAccuracyRef = useRef<Circle | null>(null);
  const leafletRef = useRef<LeafletNS | null>(null);
  const placeRef = useRef(place);
  const predictionsRef = useRef(predictions);
  const userLocationRef = useRef(userLocation);
  const onSelectRef = useRef(onSelectPrediction);
  const hasCenteredOnUser = useRef(false);
  const lastLocateRequestId = useRef(locateRequestId);
  placeRef.current = place;
  predictionsRef.current = predictions;
  userLocationRef.current = userLocation;
  onSelectRef.current = onSelectPrediction;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let resizeTimer: number | undefined;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        scrollWheelZoom: true,
      });
      L.tileLayer(OSM_TILE_URL, {
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      const hasPlace = Boolean(placeRef.current);
      const hasPredictions = predictionsRef.current.some((p) => p.lat != null);
      const onSelect = (p: PlacePrediction) => onSelectRef.current?.(p);
      syncPredictionMarkers(
        L,
        map,
        predictionMarkersRef,
        predictionsRef.current,
        placeRef.current?.placeId ?? null,
        onSelect,
        userLocationRef.current,
      );
      syncSelectedMarker(L, map, markerRef, placeRef.current);
      syncUserLocation(L, map, userMarkerRef, userAccuracyRef, userLocationRef.current, {
        pan: !hasPlace && !hasPredictions && Boolean(userLocationRef.current),
      });
      if (userLocationRef.current && !hasPlace && !hasPredictions) {
        hasCenteredOnUser.current = true;
      }
      if (!placeRef.current && !hasPredictions && !userLocationRef.current) {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      }

      resizeTimer = window.setTimeout(() => map.invalidateSize(), 50);
    })();

    return () => {
      cancelled = true;
      if (resizeTimer !== undefined) window.clearTimeout(resizeTimer);
      for (const m of predictionMarkersRef.current) m.remove();
      predictionMarkersRef.current = [];
      markerRef.current = null;
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      userAccuracyRef.current?.remove();
      userAccuracyRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    const onSelect = (p: PlacePrediction) => onSelectRef.current?.(p);
    syncPredictionMarkers(
      L,
      map,
      predictionMarkersRef,
      predictions,
      place?.placeId ?? null,
      onSelect,
      userLocation,
    );
    syncSelectedMarker(L, map, markerRef, place);

    const locatePressed = locateRequestId !== lastLocateRequestId.current;
    if (locatePressed) lastLocateRequestId.current = locateRequestId;

    const shouldPanToUser =
      locatePressed ||
      (!place &&
        !predictions.some((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)) &&
        Boolean(userLocation) &&
        !hasCenteredOnUser.current);

    syncUserLocation(L, map, userMarkerRef, userAccuracyRef, userLocation, {
      pan: shouldPanToUser,
    });

    if (shouldPanToUser && userLocation) {
      hasCenteredOnUser.current = true;
    }

    if (
      !place &&
      !predictions.some((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)) &&
      !userLocation
    ) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      hasCenteredOnUser.current = false;
    }
  }, [place, predictions, userLocation, locateRequestId]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[45vh] w-full [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:font-sans [&_.ss-places-pin]:cursor-pointer [&_.ss-places-pin]:border-0 [&_.ss-places-pin]:bg-transparent"
      aria-label={place ? `Map showing ${place.name}` : "Map"}
      role="region"
    />
  );
}
