"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UserCoords = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export type UserLocationStatus =
  | "idle"
  | "pending"
  | "ready"
  | "denied"
  | "unavailable"
  | "error";

type UseUserLocationResult = {
  coords: UserCoords | null;
  status: UserLocationStatus;
  errorMessage: string | null;
  /** Request (or re-request) the browser geolocation. */
  locate: () => void;
};

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 60_000,
};

function mapGeoError(err: GeolocationPositionError): {
  status: UserLocationStatus;
  message: string;
} {
  if (err.code === err.PERMISSION_DENIED) {
    return {
      status: "denied",
      message: "Location permission denied. Allow location access to show where you are.",
    };
  }
  if (err.code === err.POSITION_UNAVAILABLE) {
    return {
      status: "unavailable",
      message: "Location is unavailable right now.",
    };
  }
  return {
    status: "error",
    message: "Could not get your location. Try again.",
  };
}

/**
 * Browser geolocation for the Places map. Requests once on mount; call `locate` to retry.
 */
export function useUserLocation(opts?: { auto?: boolean }): UseUserLocationResult {
  const auto = opts?.auto !== false;
  const [coords, setCoords] = useState<UserCoords | null>(null);
  const [status, setStatus] = useState<UserLocationStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setErrorMessage("This browser does not support location.");
      return;
    }

    setStatus("pending");
    setErrorMessage(null);
    clearWatch();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setStatus("ready");
        setErrorMessage(null);

        // Keep the pin roughly fresh while the page is open.
        watchIdRef.current = navigator.geolocation.watchPosition(
          (next) => {
            setCoords({
              lat: next.coords.latitude,
              lng: next.coords.longitude,
              accuracy: next.coords.accuracy,
            });
            setStatus("ready");
          },
          () => {
            /* keep last good fix if watch fails */
          },
          { ...GEO_OPTIONS, maximumAge: 30_000 },
        );
      },
      (err) => {
        const mapped = mapGeoError(err);
        setStatus(mapped.status);
        setErrorMessage(mapped.message);
      },
      GEO_OPTIONS,
    );
  }, [clearWatch]);

  useEffect(() => {
    if (!auto) return;
    locate();
    return () => {
      clearWatch();
    };
  }, [auto, locate, clearWatch]);

  return { coords, status, errorMessage, locate };
}
