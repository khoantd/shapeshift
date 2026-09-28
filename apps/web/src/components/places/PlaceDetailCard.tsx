"use client";

import { Clock, ExternalLink, Globe, Phone, Star } from "lucide-react";
import { shortenOpenState } from "@/lib/places/format";
import type { PlaceDetails, PlacesProvider } from "@/lib/places/types";

type PlaceDetailCardProps = {
  place: PlaceDetails;
  provider: PlacesProvider;
};

function RatingLine({ rating, reviewCount }: { rating?: number; reviewCount?: number }) {
  if (rating == null && reviewCount == null) return null;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
      {rating != null && (
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <Star className="size-3.5 fill-amber-500 text-amber-500" aria-hidden />
          {rating.toFixed(1)}
        </span>
      )}
      {reviewCount != null && (
        <span>
          ({reviewCount.toLocaleString()} review{reviewCount === 1 ? "" : "s"})
        </span>
      )}
    </p>
  );
}

export function PlaceDetailCard({ place, provider }: PlaceDetailCardProps) {
  const mapsLabel = provider === "maptiler" ? "Open in OpenStreetMap" : "Open in Google Maps";
  const openLabel = shortenOpenState(place.openState);

  return (
    <article className="rounded-md border border-border bg-card px-3 py-3 shadow-xs">
      {place.images && place.images.length > 0 && (
        <div className="-mx-3 -mt-3 mb-3 flex gap-1 overflow-x-auto px-3 pt-3">
          {place.images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element -- remote SerpAPI thumbs; domains vary
            <img
              key={src}
              src={src}
              alt=""
              width={112}
              height={84}
              className="h-[84px] w-[112px] shrink-0 rounded-md object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ))}
        </div>
      )}

      <h2 className="text-[16px] leading-6 font-[550] text-foreground">{place.name}</h2>
      {place.formattedAddress && (
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{place.formattedAddress}</p>
      )}
      <RatingLine rating={place.rating} reviewCount={place.reviewCount} />

      {place.types && place.types.length > 0 && (
        <p className="mt-1.5 text-[12px] capitalize text-muted-foreground">
          {place.types[0]!.replace(/_/g, " ")}
        </p>
      )}

      {openLabel && (
        <p className="mt-2 inline-flex items-start gap-1.5 text-[13px] text-foreground">
          <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span>{openLabel}</span>
        </p>
      )}

      {place.hours && place.hours.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
          {place.hours.map((row) => (
            <li key={row.day} className="flex justify-between gap-3">
              <span className="font-medium text-foreground/80">{row.day}</span>
              <span className="text-end">{row.hours}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-1.5">
        {place.phone && (
          <a
            href={`tel:${place.phone.replace(/[^\d+]/g, "")}`}
            className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-foreground underline-offset-2 transition-colors duration-150 hover:text-[var(--brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Phone className="size-3.5" aria-hidden />
            {place.phone}
          </a>
        )}
        {place.website && (
          <a
            href={place.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-foreground underline-offset-2 transition-colors duration-150 hover:text-[var(--brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Globe className="size-3.5" aria-hidden />
            Website
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        {place.mapsUri && (
          <a
            href={place.mapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-foreground underline-offset-2 transition-colors duration-150 hover:text-[var(--brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {mapsLabel}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </div>

      {place.reviews && place.reviews.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <h3 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Reviews
          </h3>
          <ul className="mt-2 space-y-2.5">
            {place.reviews.map((r, i) => (
              <li key={`${r.author ?? "anon"}-${i}`} className="text-[13px] leading-5">
                <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                  {r.author && <span className="font-medium text-foreground">{r.author}</span>}
                  {r.rating != null && (
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="size-3 fill-amber-500 text-amber-500" aria-hidden />
                      {r.rating}
                    </span>
                  )}
                  {r.date && <span>· {r.date}</span>}
                </p>
                <p className="mt-0.5 text-foreground/90">{r.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
