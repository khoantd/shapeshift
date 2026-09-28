"use client";

import { Map as MapTilerMap, Marker, config as maptilerConfig, MapStyle } from "@maptiler/sdk";
import "@maptiler/sdk/style.css";
import { useEffect, useRef } from "react";
import type { PlaceDetails } from "@/lib/places/types";
import type { UserCoords } from "@/lib/places/useUserLocation";

const DEFAULT_CENTER: [number, number] = [0, 20]; // [lng, lat]
const DEFAULT_ZOOM = 2;
const SELECTED_ZOOM = 15;
const USER_ZOOM = 14;

type MapTilerPlacesMapProps = {
  apiKey: string;
  place: PlaceDetails | null;
  userLocation?: UserCoords | null;
  locateRequestId?: number;
};

export function MapTilerPlacesMap({
  apiKey,
  place,
  userLocation = null,
  locateRequestId = 0,
}: MapTilerPlacesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapTilerMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const hasCenteredOnUser = useRef(false);
  const lastLocateRequestId = useRef(locateRequestId);

  useEffect(() => {
    if (!apiKey || !containerRef.current || mapRef.current) return;

    maptilerConfig.apiKey = apiKey;
    const map = new MapTilerMap({
      container: containerRef.current,
      style: MapStyle.STREETS,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      navigationControl: true,
      geolocateControl: false,
    });
    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !apiKey) return;

    const apply = () => {
      if (!place) {
        markerRef.current?.remove();
        markerRef.current = null;
      } else {
        const lngLat: [number, number] = [place.lng, place.lat];
        map.flyTo({ center: lngLat, zoom: SELECTED_ZOOM });
        if (!markerRef.current) {
          markerRef.current = new Marker({ color: "#0f172a" }).setLngLat(lngLat).addTo(map);
        } else {
          markerRef.current.setLngLat(lngLat);
        }
        markerRef.current.getElement().title = place.name;
      }

      if (!userLocation) {
        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
      } else {
        const userLngLat: [number, number] = [userLocation.lng, userLocation.lat];
        if (!userMarkerRef.current) {
          userMarkerRef.current = new Marker({ color: "#3b82f6" })
            .setLngLat(userLngLat)
            .addTo(map);
        } else {
          userMarkerRef.current.setLngLat(userLngLat);
        }
        userMarkerRef.current.getElement().title = "You are here";
      }

      const locatePressed = locateRequestId !== lastLocateRequestId.current;
      if (locatePressed) lastLocateRequestId.current = locateRequestId;

      if (userLocation && (locatePressed || (!place && !hasCenteredOnUser.current))) {
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: USER_ZOOM,
        });
        hasCenteredOnUser.current = true;
      } else if (!place && !userLocation) {
        map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
        hasCenteredOnUser.current = false;
      }
    };

    if (map.loaded()) apply();
    else map.once("load", apply);
  }, [apiKey, place, userLocation, locateRequestId]);

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[45vh] items-center justify-center bg-muted/40 px-6 text-center">
        <p className="max-w-sm text-[14px] leading-5 text-muted-foreground">
          Map needs <code className="font-mono text-[12px]">NEXT_PUBLIC_MAPTILER_API_KEY</code>{" "}
          (or <code className="font-mono text-[12px]">MAPTILER_API_KEY</code>).
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[45vh] w-full"
      aria-label={place ? `Map showing ${place.name}` : "Map"}
      role="region"
    />
  );
}
