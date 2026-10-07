"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BrandBackdrop } from "@/components/brand/BrandBackdrop";
import { SITE_CHROME_OFFSET_CLASS } from "@/lib/site-chrome";
import {
  DEFAULT_TRENDING_TOPICS,
  normalizeFavoriteTopics,
  parseTopicsQueryParam,
  topicsToQueryParam,
} from "@/lib/github/topics";
import type {
  GithubHeadline,
  GithubReleaseItem,
  GithubRepoCard,
} from "@/lib/github/types";
import { GitHubFavoritesPanel } from "./GitHubFavoritesPanel";
import { GitHubHomeEmptyState } from "./GitHubHomeEmptyState";
import {
  GitHubNewsPanel,
  type GitHubNewsTab,
} from "./GitHubNewsPanel";
import { GitHubRepoDetail } from "./GitHubRepoDetail";

const LOCAL_TOPICS_KEY = "meanbox:github:topics";

function readLocalTopics(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_TOPICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeFavoriteTopics(
      parsed.filter((x): x is string => typeof x === "string"),
    );
  } catch {
    return [];
  }
}

function writeLocalTopics(topics: string[]) {
  try {
    localStorage.setItem(LOCAL_TOPICS_KEY, JSON.stringify(topics));
  } catch {
    /* ignore */
  }
}

function useIsLg() {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsLg(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return isLg;
}

export type GitHubPageClientProps = {
  oauthClientConfigured: boolean;
  headlinesConfigured: boolean;
  initialOAuthConnected: boolean;
  initialOAuthEmail: string | null;
  initialOAuthHasSub: boolean;
};

export function GitHubPageClient({
  oauthClientConfigured,
  headlinesConfigured,
  initialOAuthConnected,
  initialOAuthEmail,
  initialOAuthHasSub,
}: GitHubPageClientProps) {
  const t = useTranslations("GitHub");
  const searchParams = useSearchParams();
  const isLg = useIsLg();

  const [oauthConnected, setOauthConnected] = useState(initialOAuthConnected);
  const [oauthEmail, setOauthEmail] = useState(initialOAuthEmail);
  const [oauthHasSub, setOauthHasSub] = useState(initialOAuthHasSub);
  const [oauthBusy, setOauthBusy] = useState(false);

  const [favoriteTopicIds, setFavoriteTopicIds] = useState<string[]>(() => {
    const fromUrl = parseTopicsQueryParam(searchParams.get("topics"));
    return fromUrl.length ? fromUrl : [...DEFAULT_TRENDING_TOPICS];
  });
  const [favoritesSaving, setFavoritesSaving] = useState(false);

  const [repos, setRepos] = useState<GithubRepoCard[]>([]);
  const [trendingBusy, setTrendingBusy] = useState(false);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const [selected, setSelected] = useState<GithubRepoCard | null>(null);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [newsTab, setNewsTab] = useState<GitHubNewsTab>("activity");

  const [releases, setReleases] = useState<GithubReleaseItem[]>([]);
  const [headlines, setHeadlines] = useState<GithubHeadline[]>([]);
  const [activityBusy, setActivityBusy] = useState(false);
  const [headlinesBusy, setHeadlinesBusy] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [headlinesError, setHeadlinesError] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  const canPersistFavorites = oauthConnected && oauthHasSub;
  const tRef = useRef(t);
  tRef.current = t;
  const favoriteTopicIdsRef = useRef(favoriteTopicIds);
  favoriteTopicIdsRef.current = favoriteTopicIds;

  const loadFavorites = useCallback(async (connected: boolean) => {
    if (!connected) {
      const local = readLocalTopics();
      if (local.length) setFavoriteTopicIds(local);
      return;
    }
    try {
      const res = await fetch("/api/github/favorites");
      const body = (await res.json()) as {
        success?: boolean;
        topics?: string[];
      };
      if (res.ok && body.success && Array.isArray(body.topics)) {
        const topics = normalizeFavoriteTopics(body.topics);
        if (topics.length) {
          setFavoriteTopicIds(topics);
          writeLocalTopics(topics);
        }
      }
    } catch {
      /* keep current */
    }
  }, []);

  const loadTrending = useCallback(async (topicIds: string[]) => {
    setTrendingBusy(true);
    setTrendingError(null);
    try {
      const qs = topicsToQueryParam(topicIds);
      const res = await fetch(
        `/api/github/trending${qs ? `?topics=${encodeURIComponent(qs)}` : ""}`,
      );
      const body = (await res.json()) as {
        success?: boolean;
        repos?: GithubRepoCard[];
        fetchedAt?: number;
        error?: string;
      };
      if (!res.ok || !body.success) {
        setTrendingError(body.error || tRef.current("errorTrending"));
        return;
      }
      setRepos(Array.isArray(body.repos) ? body.repos : []);
      setFetchedAt(
        typeof body.fetchedAt === "number" ? body.fetchedAt : Date.now(),
      );
    } catch {
      setTrendingError(tRef.current("errorTrending"));
    } finally {
      setTrendingBusy(false);
    }
  }, []);

  const loadHeadlines = useCallback(
    async (topicIds: string[]) => {
      if (!headlinesConfigured) {
        setHeadlines([]);
        setHeadlinesError(null);
        return;
      }
      setHeadlinesBusy(true);
      setHeadlinesError(null);
      try {
        const qs = topicsToQueryParam(topicIds);
        const res = await fetch(
          `/api/github/news${qs ? `?topics=${encodeURIComponent(qs)}` : ""}`,
        );
        const body = (await res.json()) as {
          success?: boolean;
          headlines?: GithubHeadline[];
          error?: string;
        };
        if (!res.ok || !body.success) {
          setHeadlinesError(body.error || tRef.current("errorHeadlines"));
          setHeadlines([]);
          return;
        }
        setHeadlines(Array.isArray(body.headlines) ? body.headlines : []);
      } catch {
        setHeadlinesError(tRef.current("errorHeadlines"));
      } finally {
        setHeadlinesBusy(false);
      }
    },
    [headlinesConfigured],
  );

  const loadActivity = useCallback(async (list: GithubRepoCard[]) => {
    const names = list.slice(0, 6).map((r) => r.fullName);
    if (names.length === 0) {
      setReleases([]);
      return;
    }
    setActivityBusy(true);
    setActivityError(null);
    try {
      const res = await fetch(
        `/api/github/activity?repos=${encodeURIComponent(names.join(","))}`,
      );
      const body = (await res.json()) as {
        success?: boolean;
        releases?: GithubReleaseItem[];
        error?: string;
      };
      if (!res.ok || !body.success) {
        setActivityError(body.error || tRef.current("errorActivity"));
        setReleases([]);
        return;
      }
      setReleases(Array.isArray(body.releases) ? body.releases : []);
    } catch {
      setActivityError(tRef.current("errorActivity"));
    } finally {
      setActivityBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadFavorites(oauthConnected);
  }, [oauthConnected, loadFavorites]);

  useEffect(() => {
    void loadTrending(favoriteTopicIds);
    void loadHeadlines(favoriteTopicIds);
  }, [favoriteTopicIds, loadTrending, loadHeadlines]);

  useEffect(() => {
    void loadActivity(repos);
  }, [repos, loadActivity]);

  useEffect(() => {
    const oauth = searchParams.get("oauth");
    if (!oauth) return;
    if (oauth === "connected" || oauth === "connected_no_refresh") {
      setOauthConnected(true);
      void (async () => {
        try {
          const res = await fetch("/api/youtube/oauth/session");
          const body = (await res.json()) as {
            connected?: boolean;
            email?: string | null;
            hasSub?: boolean;
          };
          if (body.connected) {
            setOauthConnected(true);
            setOauthEmail(body.email ?? null);
            setOauthHasSub(body.hasSub === true);
          }
        } catch {
          /* ignore */
        }
      })();
    }
    if (oauth === "signed_out") {
      setOauthConnected(false);
      setOauthEmail(null);
      setOauthHasSub(false);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("oauth");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [searchParams]);

  const persistTopics = useCallback(
    async (next: string[]) => {
      writeLocalTopics(next);
      if (!canPersistFavorites) return;
      setFavoritesSaving(true);
      try {
        await fetch("/api/github/favorites", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topics: next }),
        });
      } catch {
        /* local already saved */
      } finally {
        setFavoritesSaving(false);
      }
    },
    [canPersistFavorites],
  );

  const toggleTopic = useCallback(
    (topicId: string) => {
      const set = new Set(favoriteTopicIdsRef.current);
      if (set.has(topicId)) set.delete(topicId);
      else set.add(topicId);
      const next = normalizeFavoriteTopics(Array.from(set));
      favoriteTopicIdsRef.current = next;

      startTransition(() => {
        setFavoriteTopicIds(next);
      });

      // Keep URL + persistence out of the setState updater — replaceState notifies
      // Next's Router, which must not setState while GitHubPageClient is rendering.
      void persistTopics(next);
      const url = new URL(window.location.href);
      if (next.length) {
        url.searchParams.set("topics", topicsToQueryParam(next));
      } else {
        url.searchParams.delete("topics");
      }
      window.history.replaceState({}, "", url.pathname + url.search);
    },
    [persistTopics],
  );

  const onSignOut = useCallback(async () => {
    setOauthBusy(true);
    try {
      await fetch("/api/youtube/oauth/logout", { method: "POST" });
      setOauthConnected(false);
      setOauthEmail(null);
      setOauthHasSub(false);
    } finally {
      setOauthBusy(false);
    }
  }, []);

  const showNews =
    Boolean(selected) ||
    releases.length > 0 ||
    headlines.length > 0 ||
    activityBusy ||
    headlinesBusy;

  const panelVariant = isLg ? "sidebar" : "stacked";

  return (
    <div
      className={`flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:flex-row lg:overflow-hidden ${SITE_CHROME_OFFSET_CLASS}`}
    >
      <GitHubFavoritesPanel
        variant={panelVariant}
        collapsed={isLg ? leftCollapsed : false}
        onToggleCollapsed={() => setLeftCollapsed((v) => !v)}
        favoriteTopicIds={favoriteTopicIds}
        onToggleTopic={toggleTopic}
        favoritesSaving={favoritesSaving}
        canPersistFavorites={canPersistFavorites}
        oauthClientConfigured={oauthClientConfigured}
        oauthConnected={oauthConnected}
        oauthEmail={oauthEmail}
        oauthBusy={oauthBusy}
        onSignOut={onSignOut}
        repos={repos}
        selectedRepoId={selected?.id ?? null}
        onSelectRepo={(repo) => {
          setSelected(repo);
          if (!isLg) setRightCollapsed(false);
        }}
        trendingBusy={trendingBusy}
        trendingError={trendingError}
        fetchedAt={fetchedAt}
        onRefresh={() => {
          void loadTrending(favoriteTopicIds);
          void loadHeadlines(favoriteTopicIds);
        }}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <BrandBackdrop
            src="/brand/main.jpg"
            scrub="light"
            position="center top"
          />
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
            {selected ? (
              <GitHubRepoDetail
                repo={selected}
                onClose={() => setSelected(null)}
              />
            ) : (
              <GitHubHomeEmptyState
                trendingPreview={repos}
                favoriteTopicIds={favoriteTopicIds}
                onToggleTopic={toggleTopic}
                onSelectRepo={setSelected}
                onFocusFavorites={() => {
                  if (isLg) setLeftCollapsed(false);
                }}
              />
            )}
          </div>
        </section>

        {showNews ? (
          <GitHubNewsPanel
            variant={panelVariant}
            collapsed={isLg ? rightCollapsed : false}
            onToggleCollapsed={() => setRightCollapsed((v) => !v)}
            tab={newsTab}
            onTabChange={setNewsTab}
            releases={
              selected
                ? releases.filter((r) => r.repoFullName === selected.fullName)
                : releases
            }
            headlines={headlines}
            activityBusy={activityBusy}
            headlinesBusy={headlinesBusy}
            activityError={activityError}
            headlinesError={headlinesError}
            headlinesConfigured={headlinesConfigured}
          />
        ) : null}
      </div>
    </div>
  );
}
