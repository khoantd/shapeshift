import {
  fetchAdvisories,
  fetchRepo,
  fetchTranscript,
  fetchVideoDetails,
  generateLearningPack,
  searchGithub,
  searchYouTube,
  summarizeRepo,
} from "./lib/api.js";
import { meanboxHref } from "./lib/config.js";
import {
  buildRelatedReposQuery,
  buildRelatedVideosQuery,
} from "./lib/parse.js";
import {
  cleanDescription,
  formatCount,
  formatIsoDuration,
  joinMeta,
  setPlainText,
  setStatus,
} from "./lib/ui.js";

const statusEl = document.getElementById("status");
const emptyEl = document.getElementById("empty-state");
const cardEl = document.getElementById("context-card");
const eyebrowEl = document.getElementById("ctx-eyebrow");
const titleEl = document.getElementById("ctx-title");
const metaEl = document.getElementById("ctx-meta");
const badgesEl = document.getElementById("ctx-badges");
const relatedListEl = document.getElementById("related-list");
const relatedCaptionEl = document.getElementById("related-caption");
const overviewExtraEl = document.getElementById("overview-extra");
const overviewExtraLabelEl = document.getElementById("overview-extra-label");
const overviewExtraBodyEl = document.getElementById("overview-extra-body");
const btnPrimary = document.getElementById("btn-primary");
const btnSecondary = document.getElementById("btn-secondary");
const openEl = document.getElementById("ctx-open");
const tabOverview = document.getElementById("tab-overview");
const tabRelated = document.getElementById("tab-related");
const panelOverview = document.getElementById("panel-overview");
const panelRelated = document.getElementById("panel-related");

/** @type {number} */
let loadId = 0;
/** @type {"github" | "youtube" | null} */
let mode = null;
/** @type {any} */
let repoCard = null;
/** @type {any} */
let videoCard = null;
/** @type {any} */
let activeContext = null;
/** @type {"overview" | "related"} */
let activeTab = "overview";

document.getElementById("btn-refresh")?.addEventListener("click", () => {
  load().catch((e) => setStatus(statusEl, e.message || String(e), "error"));
});

btnPrimary?.addEventListener("click", () => {
  if (mode === "github") {
    runSummarize().catch((e) => setStatus(statusEl, e.message || String(e), "error"));
  } else if (mode === "youtube") {
    runLearningPack().catch((e) =>
      setStatus(statusEl, e.message || String(e), "error"),
    );
  }
});

btnSecondary?.addEventListener("click", () => {
  if (mode === "github") {
    runRelatedVideos().catch((e) =>
      setStatus(statusEl, e.message || String(e), "error"),
    );
  } else if (mode === "youtube") {
    runRelatedRepos().catch((e) =>
      setStatus(statusEl, e.message || String(e), "error"),
    );
  }
});

tabOverview?.addEventListener("click", () => setTab("overview"));
tabRelated?.addEventListener("click", () => setTab("related"));

browser.storage.session.onChanged.addListener((changes) => {
  if (changes.pageContext) {
    load().catch(() => {});
  }
});

/**
 * @param {"overview" | "related"} tab
 */
function setTab(tab) {
  activeTab = tab;
  const overview = tab === "overview";
  tabOverview?.classList.toggle("is-active", overview);
  tabRelated?.classList.toggle("is-active", !overview);
  tabOverview?.setAttribute("aria-selected", overview ? "true" : "false");
  tabRelated?.setAttribute("aria-selected", overview ? "false" : "true");
  if (panelOverview) panelOverview.hidden = !overview;
  if (panelRelated) panelRelated.hidden = overview;
}

function resetUi() {
  mode = null;
  repoCard = null;
  videoCard = null;
  activeContext = null;
  cardEl.hidden = true;
  emptyEl.hidden = false;
  eyebrowEl.textContent = "Context";
  titleEl.textContent = "—";
  metaEl.textContent = "";
  badgesEl.replaceChildren();
  relatedListEl.replaceChildren();
  relatedCaptionEl.textContent = "No results yet";
  overviewExtraEl.hidden = true;
  setPlainText(overviewExtraBodyEl, "");
  btnPrimary.hidden = true;
  btnSecondary.hidden = true;
  openEl.href = "#";
  setTab("overview");
}

/**
 * @param {number} id
 */
function isStale(id) {
  return id !== loadId;
}

async function load() {
  const id = ++loadId;
  resetUi();
  setStatus(statusEl, "Loading…", "loading");

  const stored = await browser.storage.session.get("pageContext");
  let ctx = stored.pageContext;
  if (!ctx) {
    const res = await browser.runtime.sendMessage({ type: "get-page-context" });
    ctx = res?.context;
  }
  if (isStale(id)) return;

  activeContext = ctx || null;
  if (!ctx) {
    setStatus(statusEl, "", "idle");
    emptyEl.hidden = false;
    return;
  }

  if (ctx.kind === "github") {
    await loadGithub(ctx.fullName, id);
  } else if (ctx.kind === "youtube") {
    await loadYouTube(ctx.videoId, id);
  } else {
    setStatus(statusEl, "", "idle");
  }
}

/**
 * @param {string} fullName
 * @param {number} id
 */
async function loadGithub(fullName, id) {
  const [repoRes, advRes] = await Promise.all([
    fetchRepo(fullName),
    fetchAdvisories(fullName).catch((e) => ({ success: false, error: e.message })),
  ]);
  if (isStale(id)) return;

  if (!repoRes?.success || !repoRes.repo) {
    emptyEl.hidden = false;
    throw new Error(repoRes?.error || "Could not load repository");
  }

  mode = "github";
  repoCard = repoRes.repo;
  emptyEl.hidden = true;
  cardEl.hidden = false;

  eyebrowEl.textContent = "GitHub";
  titleEl.textContent = repoCard.fullName;
  metaEl.textContent =
    cleanDescription(repoCard.description, 160) || "No description";

  badgesEl.replaceChildren();
  badgesEl.appendChild(badge(`${formatCount(repoCard.stars)} stars`));
  if (repoCard.language) badgesEl.appendChild(badge(repoCard.language));
  badgesEl.appendChild(badge(`${formatCount(repoCard.forks)} forks`));

  if (advRes?.success) {
    const advisories = advRes.advisories || [];
    const total = advisories.length;
    badgesEl.appendChild(
      badge(
        total ? `${total} advisory${total === 1 ? "" : "ies"}` : "No advisories",
        total ? "warn" : "",
      ),
    );
  }

  btnPrimary.hidden = false;
  btnPrimary.textContent = "Summarize";
  btnSecondary.hidden = false;
  btnSecondary.textContent = "Find videos";
  openEl.href = await meanboxHref(
    `/github?repo=${encodeURIComponent(repoCard.fullName)}`,
  );

  setStatus(statusEl, "", "idle");
}

/**
 * @param {string} videoId
 * @param {number} id
 */
async function loadYouTube(videoId, id) {
  const details = await fetchVideoDetails(videoId);
  if (isStale(id)) return;

  if (!details?.success || !details.video) {
    emptyEl.hidden = false;
    const msg =
      details?.error?.message || details?.error || "Could not load video details";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  mode = "youtube";
  videoCard = details.video;
  emptyEl.hidden = true;
  cardEl.hidden = false;

  eyebrowEl.textContent = "YouTube";
  titleEl.textContent = videoCard.title || videoId;
  metaEl.textContent = joinMeta(
    videoCard.channelTitle,
    formatIsoDuration(videoCard.duration),
    videoCard.viewCount != null
      ? `${formatCount(Number(videoCard.viewCount))} views`
      : null,
  );

  badgesEl.replaceChildren();
  btnPrimary.hidden = false;
  btnPrimary.textContent = "Learning pack";
  btnSecondary.hidden = false;
  btnSecondary.textContent = "Find repos";
  openEl.href = await meanboxHref(
    `/youtube?videoId=${encodeURIComponent(videoCard.videoId || videoId)}`,
  );

  setStatus(statusEl, "", "idle");
}

async function runSummarize() {
  if (!repoCard) return;
  const id = loadId;
  setStatus(statusEl, "Generating summary…", "loading");
  setTab("overview");
  const res = await summarizeRepo(repoCard.fullName, {
    description: repoCard.description,
    language: "en",
  });
  if (isStale(id)) return;
  overviewExtraEl.hidden = false;
  overviewExtraLabelEl.textContent = "Summary";
  setPlainText(overviewExtraBodyEl, res.text || "");
  setStatus(statusEl, res.cached ? "Summary ready (cached)" : "Summary ready", "ok");
}

async function runRelatedVideos() {
  if (!repoCard) return;
  const id = loadId;
  setStatus(statusEl, "Searching videos…", "loading");
  const q = buildRelatedVideosQuery({
    fullName: repoCard.fullName,
    name: repoCard.name,
    description: repoCard.description,
    language: repoCard.language,
    topics: repoCard.topics,
  });
  const res = await searchYouTube(q);
  if (isStale(id)) return;
  const videos = res.videos || [];
  await renderRelated(
    videos.map((v) => ({
      title: v.title || v.videoId,
      hrefPath: `/youtube?videoId=${encodeURIComponent(v.videoId)}`,
      meta: joinMeta(v.channelTitle, formatIsoDuration(v.duration)),
    })),
    videos.length ? `${videos.length} video${videos.length === 1 ? "" : "s"}` : "No videos found",
  );
  setTab("related");
  setStatus(
    statusEl,
    videos.length ? `${Math.min(videos.length, 5)} videos` : "No videos",
    "ok",
  );
}

async function runLearningPack() {
  if (!videoCard && !activeContext?.videoId) return;
  const id = loadId;
  const videoId = videoCard?.videoId || activeContext.videoId;
  const title = videoCard?.title || videoId;
  setStatus(statusEl, "Fetching transcript…", "loading");
  setTab("overview");
  const tr = await fetchTranscript(videoId);
  if (isStale(id)) return;
  if (!tr?.success || !tr.text) {
    const msg =
      tr?.message ||
      tr?.error?.message ||
      "No transcript available — open Meanbox to paste captions.";
    setStatus(statusEl, msg, "error");
    const openUrl = await meanboxHref(`/youtube?videoId=${encodeURIComponent(videoId)}`);
    window.open(openUrl, "_blank");
    return;
  }

  setStatus(statusEl, "Generating pack…", "loading");
  const pack = await generateLearningPack({
    videoId,
    title,
    channelTitle: videoCard?.channelTitle,
    contentType: "lecture",
    transcript: tr.text,
    language: "en",
  });
  if (isStale(id)) return;
  overviewExtraEl.hidden = false;
  overviewExtraLabelEl.textContent = "Learning pack";
  setPlainText(overviewExtraBodyEl, pack.text || "");

  if (pack.saved) {
    setStatus(
      statusEl,
      pack.cached ? "Pack saved (cached)" : "Pack saved to history",
      "ok",
    );
    return;
  }

  const saveHint =
    (typeof pack.saveError === "string" && pack.saveError.trim()) ||
    "Generated but not saved — sign in on Meanbox, then regenerate.";
  setStatus(statusEl, saveHint, "error");
  const openUrl = await meanboxHref(
    `/youtube?videoId=${encodeURIComponent(videoId)}`,
  );
  window.open(openUrl, "_blank");
}

async function runRelatedRepos() {
  if (!videoCard) return;
  const id = loadId;
  setStatus(statusEl, "Searching repos…", "loading");
  const q = buildRelatedReposQuery({
    title: videoCard.title || "",
    channelTitle: videoCard.channelTitle,
  });
  const res = await searchGithub(q);
  if (isStale(id)) return;
  const repos = res.repos || [];
  await renderRelated(
    repos.map((r) => {
      const desc = cleanDescription(r.description, 100);
      return {
        title: r.fullName,
        hrefPath: `/github?repo=${encodeURIComponent(r.fullName)}`,
        meta: joinMeta(desc || null, `★ ${formatCount(r.stars)}`),
      };
    }),
    repos.length ? `${repos.length} repo${repos.length === 1 ? "" : "s"}` : "No repos found",
  );
  setTab("related");
  setStatus(
    statusEl,
    repos.length ? `${Math.min(repos.length, 5)} repos` : "No repos",
    "ok",
  );
}

/**
 * @param {{ title: string, hrefPath: string, meta: string }[]} items
 * @param {string} caption
 */
async function renderRelated(items, caption) {
  relatedCaptionEl.textContent = caption;
  relatedListEl.replaceChildren();
  const slice = items.slice(0, 5);
  if (!slice.length) {
    const li = document.createElement("li");
    li.className = "list-row";
    li.textContent = "Nothing matched. Try opening Meanbox for a broader search.";
    relatedListEl.appendChild(li);
    return;
  }
  for (const item of slice) {
    const li = document.createElement("li");
    li.className = "list-row";
    const link = document.createElement("a");
    link.href = await meanboxHref(item.hrefPath);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = item.title;
    li.appendChild(link);
    if (item.meta) {
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = item.meta;
      li.appendChild(meta);
    }
    relatedListEl.appendChild(li);
  }
}

/**
 * @param {string} text
 * @param {string} [cls]
 */
function badge(text, cls = "") {
  const span = document.createElement("span");
  span.className = cls ? `badge ${cls}` : "badge";
  span.textContent = text;
  return span;
}

load().catch((e) => setStatus(statusEl, e.message || String(e), "error"));
