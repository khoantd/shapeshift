import { capitalize, collapse, tidy } from "./common";

/** OSM-style place categories for `/category keywords` slash search. */
export const PLACE_CATEGORIES = [
  "shop",
  "amenity",
  "tourism",
  "office",
  "craft",
  "healthcare",
  "leisure",
  "service",
  "company",
  "commercial",
  /** Meta filter: places with saved person contacts (Convex), not Maps text search. */
  "contact",
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

/** True when category loads Convex contact places instead of Maps autocomplete. */
export function isContactCategory(
  category: PlaceCategory | string | null | undefined,
): boolean {
  return (category ?? "").trim().toLowerCase() === "contact";
}

export type PlaceData = {
  /** Free-text query to search in Google Places. */
  query: string;
  /** Optional category scope from `/category` slash or deep link. */
  category: PlaceCategory | null;
};

/** Result of parsing a places-page `/category keywords` command. */
export type PlaceSlashParse = {
  isSlash: boolean;
  /** Text after `/` — used to filter the category palette. */
  filterQuery: string;
  /** Canonical category when fully matched. */
  category: PlaceCategory | null;
  /** Keywords after the category name. */
  query: string;
  /** True when `category` matched a known category. */
  matched: boolean;
};

const LEAD_IN_RE =
  /^(?:show\s+me\s+|find\s+(?:me\s+)?|search\s+(?:for\s+)?|look\s+up\s+|locate\s+|where\s+is\s+|map\s+(?:of\s+)?|directions?\s+to\s+|navigate\s+to\s+)?(?:the\s+)?(?:address(?:\s+(?:for|of))?\s+|location(?:\s+(?:of|for))?\s+|place(?:\s+called)?\s+|venue\s+)?/i;

const BARE_PLACE_RE = /^(?:address|place|location|map|maps|places)\s*$/i;

const INACTIVE_SLASH: PlaceSlashParse = {
  isSlash: false,
  filterQuery: "",
  category: null,
  query: "",
  matched: false,
};

const CATEGORY_SET = new Set<string>(PLACE_CATEGORIES);

export function isPlaceCategory(value: string): value is PlaceCategory {
  return CATEGORY_SET.has(value);
}

function queryFromRest(rest: string): string {
  const cleaned = tidy(rest);
  return cleaned ? (/^[a-z]/.test(cleaned) ? capitalize(cleaned) : cleaned) : "";
}

/**
 * Parse `/category keywords` against known place categories.
 * Longest category name wins when several could match.
 */
export function parsePlaceSlash(
  text: string,
  knownCategories: readonly string[] = PLACE_CATEGORIES,
): PlaceSlashParse {
  const raw = text ?? "";
  if (!raw.startsWith("/")) return INACTIVE_SLASH;

  const filterQuery = raw.slice(1);
  const rest = collapse(filterQuery);
  if (!rest) {
    return {
      isSlash: true,
      filterQuery: "",
      category: null,
      query: "",
      matched: false,
    };
  }

  const sorted = [...new Set(knownCategories.map((s) => s.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  const lower = rest.toLowerCase();

  for (const source of sorted) {
    const name = source.toLowerCase();
    if (lower === name || lower.startsWith(`${name} `)) {
      const after = lower === name ? "" : rest.slice(source.length).trimStart();
      const category = isPlaceCategory(name) ? name : null;
      return {
        isSlash: true,
        filterQuery,
        category,
        query: queryFromRest(after),
        matched: category != null,
      };
    }
  }

  return {
    isSlash: true,
    filterQuery,
    category: null,
    query: "",
    matched: false,
  };
}

/** Build PlaceData from a palette pick + optional trailing keywords already typed. */
export function placeDataFromSlashPick(
  categoryName: string,
  trailingKeywords: string,
): PlaceData {
  const category = isPlaceCategory(categoryName.trim().toLowerCase())
    ? (categoryName.trim().toLowerCase() as PlaceCategory)
    : null;
  return {
    query: queryFromRest(collapse(trailingKeywords)),
    category,
  };
}

/**
 * Compose autocomplete search text from optional category + keywords.
 * Providers stay free-text (no shared OSM type filters).
 *
 * Appends the category only for short single-token keywords (`coffee` →
 * `coffee shop`). Multi-word queries (brand/place names) keep keywords only
 * so OSM category tokens do not muddy Maps ranking.
 */
export function composePlacesSearchQuery(
  category: PlaceCategory | string | null | undefined,
  keywords: string,
): string {
  const q = collapse(keywords);
  const cat = (category ?? "").trim().toLowerCase();
  // Contact is a Convex filter — never append it as Maps search text.
  if (isContactCategory(cat)) return q;
  if (q && cat) {
    const isShortSingleToken = !/\s/.test(q);
    return isShortSingleToken ? `${q} ${cat}` : q;
  }
  if (q) return q;
  return cat;
}

/**
 * Extract a Places search query from morphing input.
 * Strips common lead-ins ("find address", "where is", "map of") and leaves the place text.
 * Category is left null — slash/palette owns category scope.
 */
export function parsePlace(text: string): PlaceData {
  let rest = collapse(text);
  if (!rest || BARE_PLACE_RE.test(rest)) return { query: "", category: null };

  rest = collapse(rest.replace(LEAD_IN_RE, ""));
  // Drop leftover connectors after stripping lead-ins.
  rest = tidy(rest.replace(/^(?:for|of|:)\s+/i, ""));
  // "address: 1600 Amphitheatre" / "place called Blue Bottle"
  rest = tidy(rest.replace(/^(?:address|location|place|venue)\s*[:=]\s*/i, ""));

  const query = rest ? (/^[a-z]/.test(rest) ? capitalize(rest) : rest) : "";
  return { query, category: null };
}

export function completePlace(d: PlaceData) {
  const words = d.query.split(/\s+/).filter(Boolean).length;
  const base =
    (words >= 1 ? 0.45 : 0) + (words >= 2 ? 0.35 : 0) + (words >= 3 ? 0.2 : 0);
  return Math.min(1, base + (d.category ? 0.1 : 0));
}
