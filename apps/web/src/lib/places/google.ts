import "server-only";

import {
  placeDetailsSchema,
  placePredictionSchema,
  type PlaceDetails,
  type PlacePrediction,
} from "./types";
import { PlacesApiError, PlacesConfigError } from "./errors";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_URL = (placeId: string) =>
  `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;

const DETAILS_FIELD_MASK =
  "id,displayName,formattedAddress,location,types,googleMapsUri";

type GoogleSuggestion = {
  placePrediction?: {
    placeId?: string;
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
    text?: { text?: string };
  };
};

type GoogleAutocompleteBody = {
  suggestions?: GoogleSuggestion[];
};

type GooglePlaceBody = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  googleMapsUri?: string;
};

function mapPrediction(raw: GoogleSuggestion): PlacePrediction | null {
  const p = raw.placePrediction;
  if (!p?.placeId) return null;
  const mainText =
    p.structuredFormat?.mainText?.text?.trim() || p.text?.text?.trim() || "";
  if (!mainText) return null;
  const secondaryText = p.structuredFormat?.secondaryText?.text?.trim();
  const parsed = placePredictionSchema.safeParse({
    placeId: p.placeId,
    mainText,
    secondaryText: secondaryText || undefined,
  });
  return parsed.success ? parsed.data : null;
}

export async function googleAutocompletePlaces(
  input: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<PlacePrediction[]> {
  const res = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify({ input }),
    signal,
  });

  if (!res.ok) {
    throw new PlacesApiError(`Places autocomplete failed (${res.status})`, res.status);
  }

  const body = (await res.json()) as GoogleAutocompleteBody;
  const out: PlacePrediction[] = [];
  for (const suggestion of body.suggestions ?? []) {
    const mapped = mapPrediction(suggestion);
    if (mapped) out.push(mapped);
  }
  return out;
}

export async function googleGetPlaceDetails(
  placeId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<PlaceDetails> {
  if (!apiKey) throw new PlacesConfigError("Google Maps API key missing");

  const res = await fetch(PLACE_URL(placeId), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
    signal,
  });

  if (!res.ok) {
    throw new PlacesApiError(`Place details failed (${res.status})`, res.status);
  }

  const body = (await res.json()) as GooglePlaceBody;
  const lat = body.location?.latitude;
  const lng = body.location?.longitude;
  const name = body.displayName?.text?.trim() || body.formattedAddress?.trim() || "";
  const parsed = placeDetailsSchema.safeParse({
    placeId: body.id ?? placeId,
    name,
    formattedAddress: body.formattedAddress?.trim() || undefined,
    lat,
    lng,
    types: body.types?.slice(0, 50),
    mapsUri: body.googleMapsUri,
  });

  if (!parsed.success) {
    throw new PlacesApiError("Place details response was incomplete", 502);
  }
  return parsed.data;
}
