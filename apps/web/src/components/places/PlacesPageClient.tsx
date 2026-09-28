"use client";

import {
  composePlacesSearchQuery,
  isPlaceCategory,
  parsePlaceSlash,
  placeDataFromSlashPick,
  PLACE_CATEGORIES,
  type PlaceCategory,
} from "@shapeshift/core/parse/place";
import {
  PlaceCategoryPalette,
  filterPlaceCategories,
  type PlaceCategoryOption,
} from "@shapeshift/react";
import { ArrowLeft, LocateFixed, MapPin, Search, Star, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type {
  MapTilesProvider,
  PlaceDetails,
  PlacePrediction,
  PlacesProvider,
} from "@/lib/places/types";
import { shortenOpenState } from "@/lib/places/format";
import { RESULTS_PAGE_SIZE } from "@/lib/places/serpapi-search";
import { useUserLocation } from "@/lib/places/useUserLocation";
import { PlaceDetailCard } from "./PlaceDetailCard";
import { PlacesMap } from "./PlacesMap";

type PlacesPageClientProps = {
  provider: PlacesProvider;
  mapTiles: MapTilesProvider | null;
  mapsApiKey: string;
  mapId: string;
  serverConfigured: boolean;
  setupMessage: string | null;
};

type AutocompleteJson = {
  success: boolean;
  predictions?: PlacePrediction[];
  nextStart?: number | null;
  error?: { code?: string; message?: string };
};

type DetailsJson = {
  success: boolean;
  place?: PlaceDetails;
  error?: { code?: string; message?: string };
};

const DEBOUNCE_MS = 250;
/** Mirror typed `q` into the URL after the user pauses (avoid soft-nav every key). */
const URL_SYNC_MS = 300;

const CATEGORY_EXAMPLES: Record<PlaceCategory, string> = {
  shop: "stores, retail…",
  amenity: "cafe, ATM, bank…",
  tourism: "museum, hotel…",
  office: "coworking, agency…",
  craft: "bakery, workshop…",
  healthcare: "clinic, pharmacy…",
  leisure: "park, gym…",
  service: "salon, repair…",
  company: "business, HQ…",
  commercial: "mall, market…",
};

const CATEGORY_OPTIONS: PlaceCategoryOption[] = PLACE_CATEGORIES.map((name) => ({
  name,
  example: CATEGORY_EXAMPLES[name],
}));

function keywordsAfterCategory(filterQuery: string, categoryName: string): string {
  const rest = filterQuery.trim();
  const lower = rest.toLowerCase();
  const name = categoryName.toLowerCase();
  if (lower === name) return "";
  if (lower.startsWith(`${name} `) || lower.startsWith(`${name}\t`)) {
    return rest.slice(name.length).trim();
  }
  return "";
}

function parseCategoryParam(raw: string | null): PlaceCategory | null {
  const value = (raw ?? "").trim().toLowerCase();
  return isPlaceCategory(value) ? value : null;
}

export function PlacesPageClient({
  provider,
  mapTiles,
  mapsApiKey,
  mapId,
  serverConfigured,
  setupMessage,
}: PlacesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const listboxId = useId();
  const categoryListboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const mapSectionRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const detailsAbortRef = useRef<AbortController | null>(null);
  const skipUrlHydrate = useRef(false);

  const initialQ = (searchParams.get("q") ?? "").trim();
  const initialCategory = parseCategoryParam(searchParams.get("category"));

  const [query, setQuery] = useState(initialQ);
  const [category, setCategory] = useState<PlaceCategory | null>(initialCategory);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [displayLimit, setDisplayLimit] = useState(RESULTS_PAGE_SIZE);
  const [nextStart, setNextStart] = useState<number | null>(null);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlaceDetails | null>(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [locateRequestId, setLocateRequestId] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [slashDraft, setSlashDraft] = useState("");
  const [preSlashQuery, setPreSlashQuery] = useState("");
  const {
    coords: userLocation,
    status: locationStatus,
    errorMessage: locationError,
    locate,
  } = useUserLocation();

  const slashParse = useMemo(
    () => parsePlaceSlash(slashDraft || (query.startsWith("/") ? query : "")),
    [slashDraft, query],
  );
  const visibleCategories = useMemo(
    () => filterPlaceCategories(CATEGORY_OPTIONS, slashParse.filterQuery),
    [slashParse.filterQuery],
  );

  const keywordsQuery = query.startsWith("/") ? "" : query.trim();
  const searchQuery = composePlacesSearchQuery(category, keywordsQuery);
  const trimmedQuery = keywordsQuery;
  const showResultsPanel = serverConfigured && searchQuery.length >= 2;
  // Round so GPS watch jitter does not re-fire autocomplete.
  const biasLat = userLocation ? Math.round(userLocation.lat * 1e3) / 1e3 : null;
  const biasLng = userLocation ? Math.round(userLocation.lng * 1e3) / 1e3 : null;

  const onLocateClick = () => {
    locate();
    setLocateRequestId((n) => n + 1);
  };

  const syncUrl = useCallback(
    (next: {
      q?: string;
      category?: PlaceCategory | null;
      place?: string | null;
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      const q = (next.q ?? query).trim();
      if (q && !q.startsWith("/")) params.set("q", q);
      else if (!q || q.startsWith("/")) params.delete("q");

      const nextCategory =
        next.category === undefined ? category : next.category;
      if (nextCategory) params.set("category", nextCategory);
      else params.delete("category");

      if (next.place === null) params.delete("place");
      else if (next.place) params.set("place", next.place);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/places?${qs}` : "/places", { scroll: false });
      });
    },
    [category, query, router, searchParams, startTransition],
  );

  const clearSlashSession = useCallback(() => {
    setPaletteOpen(false);
    setSlashDraft("");
  }, []);

  const loadDetails = useCallback(
    async (placeId: string, opts?: { syncQuery?: string }) => {
      detailsAbortRef.current?.abort();
      const ctrl = new AbortController();
      detailsAbortRef.current = ctrl;
      try {
        await Promise.resolve();
        setDetailsBusy(true);
        setDetailsError(null);
        const res = await fetch(
          `/api/places/details?placeId=${encodeURIComponent(placeId)}`,
          { signal: ctrl.signal },
        );
        const json = (await res.json()) as DetailsJson;
        // Ignore stale responses after a newer selection started.
        if (detailsAbortRef.current !== ctrl) return;
        if (!res.ok || !json.success || !json.place) {
          setSelected((prev) => (prev?.placeId === placeId ? prev : null));
          setDetailsError(json.error?.message ?? "Could not load place details");
          return;
        }
        setSelected(json.place);
        skipUrlHydrate.current = true;
        syncUrl({
          q: opts?.syncQuery ?? query,
          category,
          place: json.place.placeId,
        });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        if (detailsAbortRef.current !== ctrl) return;
        setSelected((prev) => (prev?.placeId === placeId ? prev : null));
        setDetailsError("Could not load place details");
      } finally {
        if (detailsAbortRef.current === ctrl) setDetailsBusy(false);
      }
    },
    [category, query, syncUrl],
  );

  // Hydrate from ?place= on first mount / external URL change only.
  // Do not re-run when `selected` changes — optimistic select would see a stale
  // URL place id and reload the previous place (aborting the new details fetch).
  useEffect(() => {
    if (skipUrlHydrate.current) {
      skipUrlHydrate.current = false;
      return;
    }
    const placeId = (searchParams.get("place") ?? "").trim();
    if (!placeId || !serverConfigured) return;
    if (selected?.placeId === placeId) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await loadDetails(placeId);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL-driven hydrate only
  }, [searchParams, serverConfigured, loadDetails]);

  // Hydrate q/category from external navigation (PlaceCard deep link, back/forward)
  useEffect(() => {
    if (skipUrlHydrate.current) return;
    if (query.startsWith("/") || slashDraft.startsWith("/")) return;
    // Don't clobber in-progress typing when a soft-nav catches up.
    if (typeof document !== "undefined" && document.activeElement === inputRef.current) {
      return;
    }
    const nextCategory = parseCategoryParam(searchParams.get("category"));
    const nextQ = (searchParams.get("q") ?? "").trim();
    if (nextCategory !== category) setCategory(nextCategory);
    if (nextQ !== query) setQuery(nextQ);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps -- URL-driven hydrate only

  // Debounced URL mirror for shareable `q` (not every keystroke)
  useEffect(() => {
    if (query.startsWith("/")) return;
    const timer = setTimeout(() => {
      const urlQ = (searchParams.get("q") ?? "").trim();
      const urlCategory = parseCategoryParam(searchParams.get("category"));
      const urlPlace = (searchParams.get("place") ?? "").trim();
      const nextPlace = selected?.placeId ?? null;
      if (
        urlQ === query.trim() &&
        urlCategory === category &&
        (urlPlace || null) === nextPlace
      ) {
        return;
      }
      skipUrlHydrate.current = true;
      syncUrl({
        q: query,
        category,
        place: nextPlace,
      });
    }, URL_SYNC_MS);
    return () => clearTimeout(timer);
  }, [query, category, selected?.placeId, searchParams, syncUrl]);

  // Debounced autocomplete (clearing short queries happens in onChange)
  useEffect(() => {
    if (!serverConfigured) return;
    if (query.startsWith("/")) return;
    const q = searchQuery.trim();
    if (q.length < 2) return;

    const timer = setTimeout(() => {
      void (async () => {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        await Promise.resolve();
        setSearchBusy(true);
        setSearchError(null);
        setDisplayLimit(RESULTS_PAGE_SIZE);
        setNextStart(null);
        try {
          const params = new URLSearchParams({ q });
          if (biasLat != null && biasLng != null) {
            params.set("lat", String(biasLat));
            params.set("lng", String(biasLng));
          }
          const res = await fetch(`/api/places/autocomplete?${params}`, {
            signal: ctrl.signal,
          });
          const json = (await res.json()) as AutocompleteJson;
          if (!res.ok || !json.success) {
            setPredictions([]);
            setNextStart(null);
            setSearchError(json.error?.message ?? "Search failed");
            return;
          }
          setPredictions(json.predictions ?? []);
          setNextStart(
            typeof json.nextStart === "number" ? json.nextStart : null,
          );
          setActiveIndex(-1);
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return;
          setPredictions([]);
          setNextStart(null);
          setSearchError("Search failed");
        } finally {
          if (abortRef.current === ctrl) setSearchBusy(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query, searchQuery, serverConfigured, biasLat, biasLng]);

  const visiblePredictions = useMemo(
    () => predictions.slice(0, displayLimit),
    [predictions, displayLimit],
  );

  const canLoadMore =
    !searchBusy &&
    (displayLimit < predictions.length || nextStart != null);

  const onLoadMore = useCallback(() => {
    if (loadMoreBusy || searchBusy) return;

    if (displayLimit < predictions.length) {
      setDisplayLimit((n) => Math.min(n + RESULTS_PAGE_SIZE, predictions.length));
      return;
    }

    if (nextStart == null) return;
    const q = searchQuery.trim();
    if (q.length < 2) return;

    void (async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoadMoreBusy(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({ q, start: String(nextStart) });
        if (biasLat != null && biasLng != null) {
          params.set("lat", String(biasLat));
          params.set("lng", String(biasLng));
        }
        const res = await fetch(`/api/places/autocomplete?${params}`, {
          signal: ctrl.signal,
        });
        const json = (await res.json()) as AutocompleteJson;
        if (!res.ok || !json.success) {
          setSearchError(json.error?.message ?? "Could not load more places");
          return;
        }
        const incoming = json.predictions ?? [];
        let mergedLength = 0;
        setPredictions((prev) => {
          const seen = new Set(prev.map((p) => p.placeId));
          const merged = [...prev];
          for (const p of incoming) {
            if (seen.has(p.placeId)) continue;
            seen.add(p.placeId);
            merged.push(p);
          }
          mergedLength = merged.length;
          return merged;
        });
        setDisplayLimit((n) => Math.min(n + RESULTS_PAGE_SIZE, Math.max(mergedLength, n)));
        setNextStart(
          typeof json.nextStart === "number" ? json.nextStart : null,
        );
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setSearchError("Could not load more places");
      } finally {
        if (abortRef.current === ctrl) setLoadMoreBusy(false);
      }
    })();
  }, [
    biasLat,
    biasLng,
    displayLimit,
    loadMoreBusy,
    nextStart,
    predictions.length,
    searchBusy,
    searchQuery,
  ]);

  const selectPrediction = (prediction: PlacePrediction) => {
    // Local selection owns the URL until loadDetails syncs the new place id.
    skipUrlHydrate.current = true;
    // Keep the typed query so the results list stays stable while selecting.
    if (Number.isFinite(prediction.lat) && Number.isFinite(prediction.lng)) {
      setSelected({
        placeId: prediction.placeId,
        name: prediction.mainText,
        formattedAddress: prediction.secondaryText,
        lat: prediction.lat!,
        lng: prediction.lng!,
      });
      setDetailsError(null);
    }
    // Mobile layout stacks the map below the sidebar — bring the card into view.
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    void loadDetails(prediction.placeId, {
      syncQuery: trimmedQuery || prediction.mainText,
    });
  };

  const clearSelection = () => {
    setSelected(null);
    setDetailsError(null);
    setQuery("");
    setCategory(null);
    setPredictions([]);
    setActiveIndex(-1);
    setSearchError(null);
    clearSlashSession();
    skipUrlHydrate.current = true;
    syncUrl({ q: "", category: null, place: null });
    inputRef.current?.focus();
  };

  const clearCategory = () => {
    setCategory(null);
    skipUrlHydrate.current = true;
    syncUrl({
      q: query.startsWith("/") ? "" : query,
      category: null,
      place: selected?.placeId ?? null,
    });
  };

  const applyCategoryPick = (data: { query: string; category: PlaceCategory | null }) => {
    setCategory(data.category);
    setQuery(data.query);
    setPredictions([]);
    setActiveIndex(-1);
    setSearchError(null);
    clearSlashSession();
    skipUrlHydrate.current = true;
    syncUrl({
      q: data.query,
      category: data.category,
      place: selected?.placeId ?? null,
    });
    inputRef.current?.focus();
  };

  const onSearchChange = (next: string) => {
    if (next.startsWith("/")) {
      if (!query.startsWith("/") && !slashDraft.startsWith("/")) {
        setPreSlashQuery(query);
      }
      setSlashDraft(next);
      setQuery(next);
      setPaletteOpen(true);
      setPredictions([]);
      setSearchBusy(false);
      setSearchError(null);
      setActiveIndex(-1);
      return;
    }
    if (paletteOpen) {
      clearSlashSession();
    }
    setQuery(next);
    if (next.trim().length < 2 && !category) {
      setPredictions([]);
      setSearchBusy(false);
      setSearchError(null);
      setActiveIndex(-1);
    }
  };

  const onPickCategory = (categoryName: string) => {
    const filterQuery = slashParse.filterQuery || slashDraft.replace(/^\//, "");
    const trailing = keywordsAfterCategory(filterQuery, categoryName);
    applyCategoryPick(placeDataFromSlashPick(categoryName, trailing));
  };

  const onPaletteOpenChange = (open: boolean) => {
    setPaletteOpen(open);
    setActiveIndex(-1);
    if (!open && query.startsWith("/")) {
      setQuery(preSlashQuery);
      setSlashDraft("");
    }
    // Keep typing in the search field after dismissing the category list.
    queueMicrotask(() => inputRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (paletteOpen) {
        onPaletteOpenChange(false);
        return;
      }
      setActiveIndex(-1);
      return;
    }

    if (paletteOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (visibleCategories.length === 0) return;
        setActiveIndex((i) => (i + 1) % visibleCategories.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (visibleCategories.length === 0) return;
        setActiveIndex((i) => (i <= 0 ? visibleCategories.length - 1 : i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0 && visibleCategories[activeIndex]) {
          onPickCategory(visibleCategories[activeIndex]!.name);
          return;
        }
        if (slashParse.matched && slashParse.category) {
          applyCategoryPick({
            query: slashParse.query,
            category: slashParse.category,
          });
        }
        return;
      }
      return;
    }

    if (!showResultsPanel || !visiblePredictions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % visiblePredictions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? visiblePredictions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectPrediction(visiblePredictions[activeIndex]!);
    }
  };

  const showEmptyHint =
    serverConfigured &&
    !showResultsPanel &&
    !selected &&
    !detailsBusy &&
    !detailsError &&
    !query.startsWith("/");
  const showNoResults =
    showResultsPanel &&
    !searchBusy &&
    !searchError &&
    predictions.length === 0;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:flex-row lg:overflow-hidden">
      <aside className="relative z-10 flex w-full shrink-0 flex-col border-b border-border bg-background lg:h-full lg:w-[380px] lg:overflow-hidden lg:border-r lg:border-b-0">
        <header className="flex shrink-0 flex-col gap-4 px-4 pt-6 pb-4 sm:px-5">
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Shapeshift
            </Link>
            <div>
              <p className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                <MapPin className="size-3.5" aria-hidden />
                Places
              </p>
              <h1 className="mt-1 text-[28px] leading-8 font-[550] tracking-tight text-balance">
                Search shops and places
              </h1>
              <p className="mt-1.5 text-[14px] leading-5 text-muted-foreground">
                Type a name or address, or{" "}
                <span className="font-medium text-ink-2">/shop coffee</span> to
                filter by category — then pick from the list or map.
              </p>
            </div>
          </div>

          {!serverConfigured && (
            <div
              role="status"
              className="rounded-md border border-border bg-muted/50 px-3 py-3 text-[13px] leading-5 text-ink-2"
            >
              <p className="font-medium text-foreground">Maps setup needed</p>
              <p className="mt-1 text-muted-foreground">
                {setupMessage ??
                  "Add GOOGLE_MAPS_API_KEY and NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your env, enable Places API (New) and Maps JavaScript API, then restart the dev server."}
              </p>
            </div>
          )}

          <div className="relative">
            <label htmlFor="places-search" className="sr-only">
              Search shops and places
            </label>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={inputRef}
              id="places-search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              disabled={!serverConfigured}
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Name, address, or /shop…"
              role="combobox"
              aria-expanded={paletteOpen || showResultsPanel}
              aria-controls={paletteOpen ? categoryListboxId : listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeIndex >= 0
                  ? paletteOpen
                    ? `${categoryListboxId}-option-${activeIndex}`
                    : `${listboxId}-option-${activeIndex}`
                  : undefined
              }
              className="h-11 w-full cursor-text rounded-md border border-border bg-background pe-10 ps-10 text-[15px] text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {(query || selected || category) && (
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Clear search"
                className="absolute end-2 top-1/2 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
            <PlaceCategoryPalette
              open={paletteOpen}
              categories={CATEGORY_OPTIONS}
              filterQuery={slashParse.filterQuery}
              activeIndex={activeIndex}
              listboxId={categoryListboxId}
              onPick={onPickCategory}
            />
          </div>

          {category && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[12px] text-ink-2">
                Category: <span className="font-medium">{category}</span>
                <button
                  type="button"
                  onClick={clearCategory}
                  aria-label={`Clear ${category} category`}
                  className="inline-flex size-5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            </div>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6 sm:px-5">
          {showResultsPanel && (
            <div className="flex shrink-0 flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                  Results
                </h2>
                {!searchBusy && predictions.length > 0 && (
                  <p className="text-[12px] text-muted-foreground">
                    Showing {visiblePredictions.length} of {predictions.length}
                    {nextStart != null ? "+" : ""}
                  </p>
                )}
              </div>

              <ul
                id={listboxId}
                role="listbox"
                aria-label="Place search results"
                aria-busy={searchBusy}
                className="divide-y divide-border overflow-hidden rounded-md border border-border bg-background"
              >
                {searchBusy && predictions.length === 0 && (
                  <>
                    {[0, 1, 2].map((i) => (
                      <li key={i} className="px-3 py-3" aria-hidden>
                        <span className="block h-3.5 w-2/3 animate-pulse rounded bg-muted" />
                        <span className="mt-2 block h-3 w-full animate-pulse rounded bg-muted" />
                      </li>
                    ))}
                  </>
                )}
                {searchError && (
                  <li className="px-3 py-3 text-[13px] text-muted-foreground" role="status">
                    {searchError}
                  </li>
                )}
                {showNoResults && (
                  <li className="px-3 py-3 text-[13px] text-muted-foreground" role="status">
                    No results. Try a shop, business, or street name.
                  </li>
                )}
                {visiblePredictions.map((p, i) => {
                  const active = i === activeIndex;
                  const isSelected = selected?.placeId === p.placeId;
                  const openLabel = shortenOpenState(p.openState);
                  return (
                    <li key={p.placeId} role="presentation">
                      <button
                        type="button"
                        id={`${listboxId}-option-${i}`}
                        role="option"
                        aria-selected={isSelected || active}
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => selectPrediction(p)}
                        className={`flex w-full cursor-pointer items-start gap-2.5 px-3 py-3 text-start transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${
                          isSelected
                            ? "bg-muted"
                            : active
                              ? "bg-muted/70"
                              : "hover:bg-muted/50"
                        }`}
                      >
                        {p.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.thumbnail}
                            alt=""
                            width={40}
                            height={40}
                            className="mt-0.5 size-10 shrink-0 rounded-md object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <MapPin
                            className={`mt-0.5 size-4 shrink-0 ${
                              isSelected ? "text-foreground" : "text-muted-foreground"
                            }`}
                            aria-hidden
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-foreground">
                            {p.mainText}
                          </span>
                          {p.secondaryText && (
                            <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                              {p.secondaryText}
                            </span>
                          )}
                          {(p.rating != null || openLabel) && (
                            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
                              {p.rating != null && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Star
                                    className="size-3 fill-amber-500 text-amber-500"
                                    aria-hidden
                                  />
                                  {p.rating.toFixed(1)}
                                  {p.reviewCount != null && (
                                    <span>({p.reviewCount.toLocaleString()})</span>
                                  )}
                                </span>
                              )}
                              {openLabel && <span className="truncate">{openLabel}</span>}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {canLoadMore && (
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadMoreBusy}
                  aria-busy={loadMoreBusy}
                  className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60"
                >
                  {loadMoreBusy ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          )}

          {showEmptyHint && (
            <div className="rounded-md border border-dashed border-border px-3 py-6 text-center">
              <MapPin className="mx-auto size-5 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-[14px] font-medium text-foreground">
                Search shops and places
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Start typing a name, or use /shop coffee to filter by category.
              </p>
              {locationStatus === "ready" && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Map is centered on your current location.
                </p>
              )}
              {(locationStatus === "denied" || locationStatus === "error") && locationError && (
                <p className="mt-2 text-[12px] text-muted-foreground" role="status">
                  {locationError}
                </p>
              )}
            </div>
          )}
        </div>
      </aside>

      <section
        ref={mapSectionRef}
        className="relative z-0 isolate min-h-[45vh] flex-1 lg:h-full lg:min-h-0"
        aria-label="Map"
      >
        <PlacesMap
          provider={provider}
          mapTiles={mapTiles}
          apiKey={mapsApiKey}
          mapId={mapId || undefined}
          place={selected}
          predictions={visiblePredictions}
          userLocation={userLocation}
          locateRequestId={locateRequestId}
          onSelectPrediction={selectPrediction}
        />

        {(selected || detailsBusy || detailsError) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1100] flex justify-center p-3 pb-[3.25rem] sm:p-4 sm:pb-16">
            <div className="pointer-events-auto w-full max-w-md drop-shadow-xl">
              {detailsBusy && !selected && (
                <div
                  className="rounded-xl border border-border bg-background px-3 py-4 shadow-lg"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted" />
                </div>
              )}
              {detailsError && !detailsBusy && !selected && (
                <p
                  className="rounded-xl border border-border bg-background px-3 py-3 text-[13px] leading-5 text-muted-foreground shadow-lg"
                  role="alert"
                >
                  {detailsError}
                </p>
              )}
              {selected && (
                <PlaceDetailCard
                  place={selected}
                  provider={provider}
                  variant="map"
                  onClose={clearSelection}
                />
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onLocateClick}
          disabled={locationStatus === "pending"}
          aria-label="Show my location"
          title="Show my location"
          className="absolute end-3 bottom-3 z-[1200] inline-flex size-10 cursor-pointer items-center justify-center rounded-md border border-border bg-background text-foreground shadow-md transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60"
        >
          <LocateFixed
            className={`size-5 ${locationStatus === "ready" ? "text-blue-600" : ""}`}
            aria-hidden
          />
        </button>
      </section>
    </div>
  );
}
