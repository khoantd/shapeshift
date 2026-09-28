import {
  sanitizeHttpsUrl,
  type PlaceHoursRow,
  type PlaceReview,
} from "./types";

type SerpImage =
  | string
  | {
      thumbnail?: string;
      original?: string;
      photo_uri?: string;
    };

type SerpUserReview = {
  username?: string;
  rating?: number;
  description?: string;
  snippet?: string;
  date?: string;
  iso_date?: string;
};

type SerpUserReviews =
  | SerpUserReview[]
  | {
      most_relevant?: SerpUserReview[];
      summary?: SerpUserReview[];
    };

type SerpHoursRow =
  | { day?: string; hours?: string }
  | Record<string, string>;

/** SerpAPI returns `type` as a string or string[]; never nest it again. */
export function normalizeTypes(
  types: string[] | undefined,
  type: string | string[] | undefined,
): string[] | undefined {
  const raw = types ?? (Array.isArray(type) ? type : type ? [type] : undefined);
  if (!raw?.length) return undefined;
  return raw.filter((t): t is string => typeof t === "string" && t.length > 0).slice(0, 50);
}

export function extractImageUrls(images: SerpImage[] | undefined, extras: unknown[] = []): string[] {
  const out: string[] = [];
  const candidates = [...(images ?? []), ...extras];
  for (const item of candidates) {
    if (out.length >= 4) break;
    let url: string | undefined;
    if (typeof item === "string") url = sanitizeHttpsUrl(item);
    else if (item && typeof item === "object") {
      const obj = item as { thumbnail?: string; original?: string; photo_uri?: string };
      url =
        sanitizeHttpsUrl(obj.original) ||
        sanitizeHttpsUrl(obj.thumbnail) ||
        sanitizeHttpsUrl(obj.photo_uri);
    }
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}

export function normalizeHours(hours: SerpHoursRow[] | string | undefined): PlaceHoursRow[] | undefined {
  if (!hours) return undefined;
  if (typeof hours === "string") {
    const trimmed = hours.trim();
    if (!trimmed) return undefined;
    return [{ day: "Hours", hours: trimmed.slice(0, 120) }];
  }
  if (!Array.isArray(hours)) return undefined;
  const rows: PlaceHoursRow[] = [];
  for (const row of hours) {
    if (!row || typeof row !== "object") continue;
    if ("day" in row || "hours" in row) {
      const day = typeof row.day === "string" ? row.day.trim() : "";
      const hrs = typeof row.hours === "string" ? row.hours.trim() : "";
      if (day && hrs) rows.push({ day: day.slice(0, 40), hours: hrs.slice(0, 120) });
      continue;
    }
    for (const [day, hrs] of Object.entries(row)) {
      if (typeof hrs === "string" && day.trim() && hrs.trim()) {
        rows.push({ day: day.trim().slice(0, 40), hours: hrs.trim().slice(0, 120) });
      }
    }
    if (rows.length >= 7) break;
  }
  return rows.length ? rows.slice(0, 7) : undefined;
}

export function normalizeReviews(userReviews: SerpUserReviews | undefined): PlaceReview[] | undefined {
  if (!userReviews) return undefined;
  const list = Array.isArray(userReviews)
    ? userReviews
    : (userReviews.most_relevant ?? userReviews.summary ?? []);
  if (!list.length) return undefined;
  const out: PlaceReview[] = [];
  for (const r of list) {
    const text = (r.description ?? r.snippet ?? "").trim();
    if (!text) continue;
    out.push({
      author: r.username?.trim().slice(0, 200) || undefined,
      rating: Number.isFinite(r.rating) ? r.rating : undefined,
      text: text.slice(0, 2000),
      date: (r.date ?? r.iso_date)?.trim().slice(0, 100) || undefined,
    });
    if (out.length >= 3) break;
  }
  return out.length ? out : undefined;
}
