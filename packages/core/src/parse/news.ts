import { capitalize, collapse, tidy } from "./common";

export type NewsData = {
  /** Topic or query to filter the curated feed. */
  topic: string;
  /** Prefer pinned / unread / urgent takeaways. */
  criticalOnly: boolean;
  /** Optional source name hinted in the text (e.g. "from Reuters"). */
  sourceHint: string | null;
};

/** Result of parsing a news-page `/source keywords` command. */
export type NewsSlashParse = {
  isSlash: boolean;
  /** Text after `/` — used to filter the source palette. */
  filterQuery: string;
  /** Canonical source display name when fully matched. */
  sourceHint: string | null;
  topic: string;
  criticalOnly: boolean;
  /** True when `sourceHint` matched a known source name. */
  matched: boolean;
};

const CRITICAL_RE =
  /\b(critical|urgent|must[- ]know|key takeaways?|tl;?dr|briefing|headlines? only)\b/i;

const LEAD_IN_RE =
  /^(?:show\s+me\s+|get\s+me\s+|find\s+|search\s+)?(?:the\s+)?(?:critical\s+|urgent\s+|key\s+)?(?:news|headlines?|briefing|feed|stories|updates?)(?:\s+(?:about|on|for|regarding|re))?[\s:]*/i;

const SOURCE_RE = /\b(?:from|via|source)\s+([A-Za-z][\w.&' -]{1,40})\b/i;

const INACTIVE_SLASH: NewsSlashParse = {
  isSlash: false,
  filterQuery: "",
  sourceHint: null,
  topic: "",
  criticalOnly: false,
  matched: false,
};

function topicFromRest(rest: string): { topic: string; criticalOnly: boolean } {
  const criticalOnly = CRITICAL_RE.test(rest);
  let cleaned = collapse(rest.replace(CRITICAL_RE, " "));
  cleaned = tidy(cleaned.replace(/^(?:about|on|for|regarding|re)\s+/i, ""));
  const topic = cleaned ? (/^[a-z]/.test(cleaned) ? capitalize(cleaned) : cleaned) : "";
  return { topic, criticalOnly };
}

/**
 * Parse `/SourceName keywords` against a list of known feed source display names.
 * Longest source name wins when several could match.
 */
export function parseNewsSlash(text: string, knownSources: string[]): NewsSlashParse {
  const raw = text ?? "";
  if (!raw.startsWith("/")) return INACTIVE_SLASH;

  const filterQuery = raw.slice(1);
  const rest = collapse(filterQuery);
  if (!rest) {
    return {
      isSlash: true,
      filterQuery: "",
      sourceHint: null,
      topic: "",
      criticalOnly: false,
      matched: false,
    };
  }

  const sorted = [...new Set(knownSources.map((s) => s.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  const lower = rest.toLowerCase();

  for (const source of sorted) {
    const name = source.toLowerCase();
    if (lower === name || lower.startsWith(`${name} `)) {
      const after = lower === name ? "" : rest.slice(source.length).trimStart();
      const { topic, criticalOnly } = topicFromRest(after);
      return {
        isSlash: true,
        filterQuery,
        sourceHint: source,
        topic,
        criticalOnly,
        matched: true,
      };
    }
  }

  return {
    isSlash: true,
    filterQuery,
    sourceHint: null,
    topic: "",
    criticalOnly: false,
    matched: false,
  };
}

/** Build NewsData from a palette pick + optional trailing keywords already typed. */
export function newsDataFromSlashPick(
  sourceName: string,
  trailingKeywords: string,
): NewsData {
  const { topic, criticalOnly } = topicFromRest(collapse(trailingKeywords));
  return {
    topic,
    criticalOnly,
    sourceHint: sourceName.trim() || null,
  };
}

export function parseNews(text: string): NewsData {
  const criticalOnly = CRITICAL_RE.test(text);
  let rest = collapse(text);

  const sourceMatch = rest.match(SOURCE_RE);
  let sourceHint: string | null = null;
  if (sourceMatch) {
    sourceHint = capitalize(tidy(sourceMatch[1]!));
    rest = collapse(rest.replace(SOURCE_RE, " "));
  }

  rest = collapse(rest.replace(LEAD_IN_RE, ""));
  rest = collapse(rest.replace(CRITICAL_RE, " "));
  // Drop leftover connectors after stripping lead-ins / critical words.
  rest = tidy(rest.replace(/^(?:about|on|for|regarding|re)\s+/i, ""));

  return {
    topic: rest ? (/^[a-z]/.test(rest) ? capitalize(rest) : rest) : "",
    criticalOnly,
    sourceHint,
  };
}

export function completeNews(d: NewsData) {
  const words = d.topic.split(/\s+/).filter(Boolean).length;
  return Math.min(1, (words >= 1 ? 0.5 : 0) + (words >= 2 ? 0.3 : 0) + (d.criticalOnly ? 0.1 : 0) + (d.sourceHint ? 0.1 : 0));
}
