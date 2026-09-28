"use client";

import { AdvancedMarker, APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useState } from "react";
import type { PlaceDetails } from "@/lib/places/types";
import type { UserCoords } from "@/lib/places/useUserLocation";

const DEFAULT_CENTER = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 2;
const SELECTED_ZOOM = 15;
const USER_ZOOM = 14;

type Camera = { center: { lat: number; lng: number }; zoom: number };

type GooglePlacesMapProps = {
  apiKey: string;
  mapId?: string;
  place: PlaceDetails | null;
  userLocation?: UserCoords | null;
  locateRequestId?: number;
};

function cameraForPlace(place: PlaceDetails | null, user: UserCoords | null | undefined): Camera {
  if (place) return { center: { lat: place.lat, lng: place.lng }, zoom: SELECTED_ZOOM };
  if (user) return { center: { lat: user.lat, lng: user.lng }, zoom: USER_ZOOM };
  return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
}

export function GooglePlacesMap({
  apiKey,
  mapId,
  place,
  userLocation = null,
  locateRequestId = 0,
}: GooglePlacesMapProps) {
  const placeKey = place?.placeId ?? "";
  const [syncedKey, setSyncedKey] = useState(placeKey);
  const [camera, setCamera] = useState<Camera>(() => cameraForPlace(place, userLocation));
  const [lastLocateId, setLastLocateId] = useState(locateRequestId);
  const [hasCenteredOnUser, setHasCenteredOnUser] = useState(false);

  if (placeKey !== syncedKey) {
    setSyncedKey(placeKey);
    setCamera(cameraForPlace(place, userLocation));
  }

  if (locateRequestId !== lastLocateId) {
    setLastLocateId(locateRequestId);
    if (userLocation) {
      setCamera({ center: { lat: userLocation.lat, lng: userLocation.lng }, zoom: USER_ZOOM });
    }
  }

  useEffect(() => {
    if (place || hasCenteredOnUser || !userLocation) return;
    setCamera({ center: { lat: userLocation.lat, lng: userLocation.lng }, zoom: USER_ZOOM });
    setHasCenteredOnUser(true);
  }, [place, userLocation, hasCenteredOnUser]);

  const onCameraChanged = useCallback(
    (ev: { detail: { center: { lat: number; lng: number }; zoom: number } }) => {
      setCamera({
        center: { lat: ev.detail.center.lat, lng: ev.detail.center.lng },
        zoom: ev.detail.zoom,
      });
    },
    [],
  );

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[45vh] items-center justify-center bg-muted/40 px-6 text-center">
        <p className="max-w-sm text-[14px] leading-5 text-muted-foreground">
          Map needs <code className="font-mono text-[12px]">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          (Maps JavaScript API).
        </p>
      </div>
    );
  }

  const useAdvanced = Boolean(mapId);

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        className="h-full min-h-[45vh] w-full"
        center={camera.center}
        zoom={camera.zoom}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapId={useAdvanced ? mapId : undefined}
        onCameraChanged={onCameraChanged}
        aria-label={place ? `Map showing ${place.name}` : "Map"}
      >
        {userLocation &&
          (useAdvanced ? (
            <AdvancedMarker
              position={{ lat: userLocation.lat, lng: userLocation.lng }}
              title="You are here"
            />
          ) : (
            <Marker
              position={{ lat: userLocation.lat, lng: userLocation.lng }}
              title="You are here"
            />
          ))}
        {place &&
          (useAdvanced ? (
            <AdvancedMarker
              position={{ lat: place.lat, lng: place.lng }}
              title={place.name}
            />
          ) : (
            <Marker position={{ lat: place.lat, lng: place.lng }} title={place.name} />
          ))}
      </Map>
    </APIProvider>
  );
}
