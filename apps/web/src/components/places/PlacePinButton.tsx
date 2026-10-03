"use client";

import { notify } from "@shapeshift/react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Pin } from "lucide-react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { isConvexConfigured } from "../ConvexClientProvider";

/** Minimal place snapshot for pin/unpin (detail or list row). */
export type PlacePinTarget = {
  placeId: string;
  name: string;
  formattedAddress?: string;
  lat?: number;
  lng?: number;
};

type PlacePinButtonProps = {
  place: PlacePinTarget;
  /** Icon-only control for dense map header / list rows; labeled for sidebar. */
  compact?: boolean;
  /** After a successful pin, toast "View" runs this (e.g. open `/pinned`). */
  onPinnedNavigate?: () => void;
};

/**
 * Pin / unpin a place via Convex. Hidden when Convex is not configured.
 */
export function PlacePinButton({
  place,
  compact = false,
  onPinnedNavigate,
}: PlacePinButtonProps) {
  if (!isConvexConfigured()) return null;
  return (
    <PlacePinButtonInner
      place={place}
      compact={compact}
      onPinnedNavigate={onPinnedNavigate}
    />
  );
}

function PlacePinButtonInner({
  place,
  compact,
  onPinnedNavigate,
}: PlacePinButtonProps) {
  const pinned = useQuery(api.placePins.isPinned, { placeId: place.placeId });
  const toggle = useMutation(api.placePins.toggle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPinned = pinned === true;
  const loading = pinned === undefined;

  const onToggle = async () => {
    if (busy || loading) return;
    setBusy(true);
    setError(null);
    const wasPinned = isPinned;
    try {
      const result = await toggle({
        placeId: place.placeId,
        placeName: place.name,
        formattedAddress: place.formattedAddress,
        lat: place.lat,
        lng: place.lng,
      });
      const nowPinned = result.pinned;
      notify(place.name, {
        lead: nowPinned ? "Pinned" : "Unpinned",
        id: `place-pin-${place.placeId}`,
        ...(nowPinned && onPinnedNavigate && !wasPinned
          ? {
              action: {
                label: "View",
                onClick: onPinnedNavigate,
              },
            }
          : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update pin");
    } finally {
      setBusy(false);
    }
  };

  const label = isPinned ? "Unpin" : "Pin";
  const ariaLabel = isPinned ? "Unpin place" : "Pin place";

  return (
    <div className={compact ? "shrink-0" : "mt-2"}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void onToggle();
        }}
        disabled={busy || loading}
        aria-pressed={isPinned}
        aria-busy={busy || loading}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={
          compact
            ? `inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60 ${
                isPinned
                  ? "text-[var(--brand)] hover:bg-muted"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            : `inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60 ${
                isPinned
                  ? "border-[var(--brand)]/40 bg-[var(--brand)]/10 text-[var(--brand)] hover:bg-[var(--brand)]/15"
                  : "bg-background text-foreground hover:bg-muted"
              }`
        }
      >
        {busy || loading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Pin
            className={`size-3.5 ${isPinned ? "fill-current" : ""}`}
            aria-hidden
          />
        )}
        {!compact && <span>{label}</span>}
      </button>
      {error && (
        <p className="mt-1 text-[12px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
