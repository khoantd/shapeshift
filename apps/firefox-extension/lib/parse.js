/** Parse GitHub / YouTube URLs into page context. */

const REPO_PATH =
  /^\/([^/]+)\/([^/]+)(?:\/(tree|blob|issues|pull|actions|security|releases|wiki|projects|settings|pulse|graphs|network|forks)(?:\/|$))?/i;

/**
 * @param {string} href
 * @returns {{ kind: "github", owner: string, name: string, fullName: string, url: string } | null}
 */
export function parseGitHubRepoUrl(href) {
  let u;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (u.hostname !== "github.com" && u.hostname !== "www.github.com") {
    return null;
  }
  const m = u.pathname.match(REPO_PATH);
  if (!m) return null;
  const owner = m[1];
  const name = m[2];
  if (
    !owner ||
    !name ||
    owner === "settings" ||
    owner === "marketplace" ||
    owner === "explore" ||
    owner === "notifications" ||
    owner === "orgs" ||
    owner === "topics" ||
    owner === "search" ||
    name === "settings"
  ) {
    return null;
  }
  // Skip user profile-only paths like /owner with no repo
  if (name === owner && !m[3]) {
    // still valid as owner/repo when both segments present
  }
  return {
    kind: "github",
    owner,
    name,
    fullName: `${owner}/${name}`,
    url: `https://github.com/${owner}/${name}`,
  };
}

/**
 * @param {string} href
 * @returns {{ kind: "youtube", videoId: string, url: string } | null}
 */
export function parseYouTubeVideoUrl(href) {
  let u;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (isVideoId(id)) {
      return { kind: "youtube", videoId: id, url: `https://www.youtube.com/watch?v=${id}` };
    }
    return null;
  }
  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") {
    return null;
  }
  const v = u.searchParams.get("v");
  if (isVideoId(v)) {
    return { kind: "youtube", videoId: v, url: `https://www.youtube.com/watch?v=${v}` };
  }
  const shorts = u.pathname.match(/^\/shorts\/([\w-]{11})/);
  if (shorts) {
    return {
      kind: "youtube",
      videoId: shorts[1],
      url: `https://www.youtube.com/watch?v=${shorts[1]}`,
    };
  }
  const embed = u.pathname.match(/^\/embed\/([\w-]{11})/);
  if (embed) {
    return {
      kind: "youtube",
      videoId: embed[1],
      url: `https://www.youtube.com/watch?v=${embed[1]}`,
    };
  }
  return null;
}

/**
 * @param {string | null | undefined} id
 */
export function isVideoId(id) {
  return typeof id === "string" && /^[\w-]{11}$/.test(id);
}

/**
 * @param {string} href
 */
export function parsePageContext(href) {
  return parseGitHubRepoUrl(href) || parseYouTubeVideoUrl(href);
}

/**
 * Build a YouTube search query from a GitHub repo card (mirrors web app helper).
 * @param {{ fullName: string, name: string, description?: string | null, language?: string | null, topics?: readonly string[] }} input
 */
export function buildRelatedVideosQuery(input) {
  const name = (input.name || "").trim() || input.fullName.split("/")[1] || "";
  const topic = (input.topics ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  const lang = input.language?.trim() || "";
  const parts = [name, topic || lang, "tutorial"].filter((p) => p.length > 0);
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * Build a GitHub search query from a YouTube video (mirrors web app helper).
 * @param {{ title: string, channelTitle?: string | null, topicLabel?: string | null }} input
 */
export function buildRelatedReposQuery(input) {
  const NOISE =
    /\b(official|trailer|full\s*course|tutorial|explained|review|vs\.?|part\s*\d+|ep\.?\s*\d+|howto|how\s*to|learn)\b/gi;
  let title = input.title.replace(NOISE, " ").replace(/[|•·]/g, " ");
  title = title.replace(/\s+/g, " ").trim();
  const tokens = title
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  const topic = input.topicLabel?.trim();
  if (
    topic &&
    topic.length >= 2 &&
    !tokens.some((t) => t.toLowerCase() === topic.toLowerCase())
  ) {
    tokens.push(topic);
  }
  const q = tokens.join(" ").trim();
  if (q.length >= 2) return q.slice(0, 100);
  const channel = input.channelTitle?.trim() ?? "";
  return channel.slice(0, 100) || "open source";
}
