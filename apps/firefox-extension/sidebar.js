import { mergeArticleWithQuery } from "./lib/article.js";
import {
  clipNewsArticle,
  fetchAdvisories,
  fetchRepo,
  fetchSavedLearningPack,
  fetchTranscript,
  fetchVideoDetails,
  formatLocalSaveHint,
  formatUnsavedPackHint,
  generateLearningPack,
  generateNewsDeepDive,
  hasMeanboxSession,
  searchGithub,
  searchYouTube,
  structureRtcfc,
  summarizeRepo,
} from "./lib/api.js";
import { getSettings, meanboxHref } from "./lib/config.js";
import {
  getLocalItem,
  markSynced,
  saveLocalItem,
} from "./lib/localHistory.js";
import {
  composeRtcfc,
  exampleSeed,
  formatClock,
  gadgetFromRtcfc,
  isQuickGadgetIntent,
  resolveQuickGadget,
  rollRtcfc,
} from "./lib/gadgets.js";
import {
  buildRelatedReposQuery,
  buildRelatedVideosQuery,
} from "./lib/parse.js";
import { gadgetsPath, placesPath } from "./lib/paths.js";
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
const overviewSourcesEl = document.getElementById("overview-sources");
const btnPrimary = document.getElementById("btn-primary");
const btnSecondary = document.getElementById("btn-secondary");
const openEl = document.getElementById("ctx-open");
const cardFooterEl = document.getElementById("card-footer");
const tabsEl = document.getElementById("ctx-tabs");
const tabOverview = document.getElementById("tab-overview");
const tabRelated = document.getElementById("tab-related");
const panelOverview = document.getElementById("panel-overview");
const panelRelated = document.getElementById("panel-related");

/** @type {number} */
let loadId = 0;
/**
 * When > 0, ignore pageContext session.onChanged → load() so sidebar-owned
 * writes (Deep dive refresh/clip, gadget roll) do not abort in-flight work.
 * @type {number}
 */
let suppressPageContextReload = 0;
/** @type {"github" | "youtube" | "article" | "gadget" | null} */
let mode = null;
/** @type {any} */
let repoCard = null;
/** @type {any} */
let videoCard = null;
/** @type {any} */
let activeContext = null;
/** @type {"overview" | "related"} */
let activeTab = "overview";
/** @type {boolean} */
let articleHasDeepDive = false;
/** @type {ReturnType<typeof setInterval> | null} */
let timerInterval = null;
/** @type {number | null} */
let timerRemaining = null;
/** @type {boolean} */
let timerRunning = false;

document.getElementById("btn-refresh")?.addEventListener("click", () => {
  load().catch((e) => setStatus(statusEl, e.message || String(e), "error"));
});

const launchForm = document.getElementById("launch-form");
const launchQ = /** @type {HTMLTextAreaElement | null} */ (
  document.getElementById("launch-q")
);

launchForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  openLaunch("gadgets").catch((err) =>
    setStatus(statusEl, err.message || String(err), "error"),
  );
});

document.querySelectorAll("[data-launch]").forEach((btn) => {
  if (btn.getAttribute("type") === "submit") return;
  btn.addEventListener("click", () => {
    const kind = btn.getAttribute("data-launch");
    if (kind === "news" || kind === "places" || kind === "gadgets") {
      openLaunch(kind).catch((err) =>
        setStatus(statusEl, err.message || String(err), "error"),
      );
    }
  });
});

document.querySelectorAll("[data-gadget]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const intent = btn.getAttribute("data-gadget");
    if (!isQuickGadgetIntent(intent || "")) return;
    launchQuickGadget(launchQ?.value || "", /** @type {any} */ (intent)).catch(
      (err) => setStatus(statusEl, err.message || String(err), "error"),
    );
  });
});

/**
 * @param {"gadgets" | "news" | "places"} kind
 */
async function openLaunch(kind) {
  const q = (launchQ?.value || "").trim();
  if (kind === "news") {
    await launchNewsDeepDive(q);
    return;
  }
  if (kind === "gadgets") {
    if (q) {
      const quick = resolveQuickGadget(q);
      if (quick) {
        await openQuickGadgetContext(quick);
        return;
      }
    }
    const path = gadgetsPath(q);
    const url = await meanboxHref(path);
    await browser.tabs.create({ url });
    return;
  }
  const path = placesPath(q);
  const url = await meanboxHref(path);
  await browser.tabs.create({ url });
}

/**
 * @param {string} text
 * @param {"tip" | "split" | "convert" | "timer" | "rtcfc" | null} [preferred]
 */
async function launchQuickGadget(text, preferred = null) {
  const q = String(text || "").trim();
  const quick = resolveQuickGadget(q, preferred);
  if (!quick) {
    if (preferred) {
      const seeded = resolveQuickGadget(exampleSeed(preferred), preferred);
      if (seeded) {
        if (launchQ) launchQ.value = seeded.query;
        await openQuickGadgetContext(seeded);
        return;
      }
    }
    setStatus(
      statusEl,
      "Try tip 18% on $90, split $40 for 3, 10 km to mi, or 25 min focus.",
      "error",
    );
    return;
  }
  if (launchQ && !q && preferred) launchQ.value = quick.query;
  await openQuickGadgetContext(quick);
}

/**
 * @param {any} context
 */
async function openQuickGadgetContext(context) {
  await browser.runtime.sendMessage({
    type: "open-quick-gadget",
    context,
  });
  await load();
}

/**
 * Fresh-extract the active tab into article context (force main-body grab).
 * @returns {Promise<any | null>}
 */
async function refreshArticleFromActiveTab() {
  const res = await browser.runtime.sendMessage({
    type: "extract-active-article",
    force: true,
  });
  const ctx = res?.context;
  if (!ctx || ctx.kind !== "article") return null;
  activeContext = ctx;
  await setPageContextLocal(ctx);
  return ctx;
}

/**
 * Prefer active-tab article; else topic from launch box. Never opens Meanbox.
 * @param {string} q
 */
async function launchNewsDeepDive(q) {
  setStatus(statusEl, "Preparing deep dive…", "loading");
  const extracted = await refreshArticleFromActiveTab();
  const ctx = mergeArticleWithQuery(extracted, q);
  if (!ctx) {
    setStatus(
      statusEl,
      "Enter a topic or open a page (grant host access in Options).",
      "error",
    );
    return;
  }
  await browser.runtime.sendMessage({
    type: "open-article-deep-dive",
    context: ctx,
    autoRun: true,
  });
  await load();
}

btnPrimary?.addEventListener("click", () => {
  if (mode === "github") {
    runSummarize().catch((e) => setStatus(statusEl, e.message || String(e), "error"));
  } else if (mode === "youtube") {
    runLearningPack().catch((e) =>
      setStatus(statusEl, e.message || String(e), "error"),
    );
  } else if (mode === "article") {
    runDeepDive({ force: articleHasDeepDive }).catch((e) =>
      setStatus(statusEl, e.message || String(e), "error"),
    );
  } else if (mode === "gadget") {
    onGadgetPrimary().catch((e) =>
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
  } else if (mode === "gadget") {
    onGadgetSecondary().catch((e) =>
      setStatus(statusEl, e.message || String(e), "error"),
    );
  }
});

tabOverview?.addEventListener("click", () => setTab("overview"));
tabRelated?.addEventListener("click", () => setTab("related"));

browser.storage.session.onChanged.addListener((changes) => {
  if (changes.pageContext) {
    if (suppressPageContextReload > 0) return;
    load().catch(() => {});
    return;
  }
  // Only reload when a deep dive was just requested (avoid loop on clear).
  if (changes.pendingDeepDive?.newValue === true) {
    load().catch(() => {});
  }
});

/**
 * Persist pageContext from the sidebar without re-entering load().
 * Background tab sync still writes directly and refreshes the UI.
 * @param {any} ctx
 */
async function setPageContextLocal(ctx) {
  suppressPageContextReload += 1;
  try {
    await browser.storage.session.set({ pageContext: ctx });
    // onChanged may run after the set promise resolves — stay suppressed one tick.
    await new Promise((r) => setTimeout(r, 0));
  } finally {
    suppressPageContextReload = Math.max(0, suppressPageContextReload - 1);
  }
}

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
  articleHasDeepDive = false;
  stopGadgetTimer(true);
  document.getElementById("gadget-clock")?.remove();
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
  clearSources();
  btnPrimary.hidden = true;
  btnSecondary.hidden = true;
  if (openEl) openEl.href = "#";
  if (cardFooterEl) cardFooterEl.hidden = true;
  if (tabsEl) tabsEl.hidden = false;
  if (tabRelated) tabRelated.hidden = false;
  setTab("overview");
}

function clearSources() {
  if (!overviewSourcesEl) return;
  overviewSourcesEl.replaceChildren();
  overviewSourcesEl.hidden = true;
}

/**
 * @param {{ title?: string, url?: string }[]} sources
 */
function renderSources(sources) {
  if (!overviewSourcesEl) return;
  overviewSourcesEl.replaceChildren();
  const list = Array.isArray(sources) ? sources : [];
  const seen = new Set();
  let count = 0;
  for (const src of list) {
    const url = typeof src?.url === "string" ? src.url.trim() : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const li = document.createElement("li");
    li.className = "list-row";
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent =
      (typeof src.title === "string" && src.title.trim()) || url;
    li.appendChild(a);
    overviewSourcesEl.appendChild(li);
    count += 1;
    if (count >= 8) break;
  }
  overviewSourcesEl.hidden = count === 0;
}

/**
 * @param {number} id
 */
function isStale(id) {
  return id !== loadId;
}

/**
 * @param {"learning_pack"|"repo_summary"|"news_deep_dive"|"gadget"} kind
 * @param {string} dedupeKey
 * @param {Record<string, unknown>} payload
 */
async function persistLocal(kind, dedupeKey, payload) {
  const { apiBase } = await getSettings();
  return saveLocalItem({ kind, dedupeKey, payload, apiBase });
}

/** @param {string} url */
function articleDedupeKey(url) {
  return String(url || "")
    .trim()
    .toLowerCase();
}

/**
 * @param {any} ctx
 */
async function persistGadgetLocal(ctx) {
  if (!ctx?.ready) return;
  const intent = String(ctx.intent || "gadget");
  const query = String(ctx.query || "").trim().toLowerCase();
  await persistLocal("gadget", `${intent}:${query || intent}`, {
    intent,
    query: ctx.query || "",
    lines: Array.isArray(ctx.lines) ? ctx.lines : [],
    rtcfc: ctx.rtcfc || null,
  });
}

async function load() {
  const id = ++loadId;
  resetUi();
  setStatus(statusEl, "Loading…", "loading");

  const stored = await browser.storage.session.get([
    "pageContext",
    "pendingDeepDive",
  ]);
  let ctx = stored.pageContext;
  const pendingDeepDive = Boolean(stored.pendingDeepDive);
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
  } else if (ctx.kind === "article") {
    await loadArticle(ctx, id, pendingDeepDive);
  } else if (ctx.kind === "gadget") {
    await loadGadget(ctx, id);
  } else {
    setStatus(statusEl, "", "idle");
  }
}

/**
 * @param {any} ctx
 * @param {number} id
 */
async function loadGadget(ctx, id) {
  mode = "gadget";
  stopGadgetTimer(true);
  emptyEl.hidden = true;
  cardEl.hidden = false;
  if (tabsEl) tabsEl.hidden = true;
  if (tabRelated) tabRelated.hidden = true;
  setTab("overview");

  eyebrowEl.textContent = "Gadget";
  titleEl.textContent = ctx.title || ctx.intent || "Gadget";
  metaEl.textContent = ctx.meta || ctx.query || "";
  badgesEl.replaceChildren();
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = String(ctx.intent || "gadget");
  badgesEl.appendChild(badge);

  overviewExtraEl.hidden = false;
  overviewExtraLabelEl.textContent =
    ctx.intent === "rtcfc" ? "Prompt" : "Result";
  renderGadgetBody(ctx);
  clearSources();

  const isTimer = ctx.intent === "timer" && ctx.ready && ctx.timerSeconds > 0;
  const isRtcfc = ctx.intent === "rtcfc";
  if (isTimer) {
    timerRemaining = Number(ctx.timerSeconds);
    timerRunning = false;
    btnPrimary.hidden = false;
    btnPrimary.textContent = "Start";
    btnSecondary.hidden = false;
    btnSecondary.textContent = "Reset";
  } else if (isRtcfc) {
    btnPrimary.hidden = false;
    btnPrimary.textContent = ctx.needsStructure ? "Structure" : "Copy";
    btnSecondary.hidden = false;
    btnSecondary.textContent = "Roll again";
  } else {
    btnPrimary.hidden = true;
    btnSecondary.hidden = true;
  }

  if (openEl && cardFooterEl) {
    openEl.href = await meanboxHref(gadgetsPath(ctx.query || ""));
    cardFooterEl.hidden = false;
  }

  if (isStale(id)) return;

  if (isRtcfc && ctx.needsStructure) {
    setStatus(statusEl, "Structuring RTCFC…", "loading");
    await runRtcfcStructure({ loadToken: id });
    return;
  }

  if (ctx.ready) {
    await persistGadgetLocal(ctx);
  }

  setStatus(
    statusEl,
    ctx.ready
      ? isRtcfc
        ? "RTCFC ready — Copy or open in Meanbox to edit."
        : "Quick gadget — open in Meanbox to save or edit further."
      : "Almost there — refine the phrase or open in Meanbox.",
    ctx.ready ? "ok" : "error",
  );
}

/**
 * @param {any} ctx
 */
function renderGadgetBody(ctx) {
  if (!overviewExtraEl || !overviewExtraBodyEl) return;
  const existingClock = document.getElementById("gadget-clock");
  existingClock?.remove();

  if (ctx.intent === "timer" && ctx.ready) {
    const clock = document.createElement("p");
    clock.className = "gadget-clock";
    clock.id = "gadget-clock";
    clock.textContent = formatClock(timerRemaining ?? ctx.timerSeconds ?? 0);
    overviewExtraEl.insertBefore(clock, overviewExtraBodyEl);
  }

  setPlainText(
    overviewExtraBodyEl,
    Array.isArray(ctx.lines) ? ctx.lines.join("\n") : "",
  );
}

function syncGadgetClock() {
  const clock = document.getElementById("gadget-clock");
  if (clock && timerRemaining !== null) {
    clock.textContent = formatClock(timerRemaining);
  }
}

/**
 * @param {boolean} [clearRemaining]
 */
function stopGadgetTimer(clearRemaining = false) {
  if (timerInterval != null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerRunning = false;
  if (clearRemaining) timerRemaining = null;
}

async function onGadgetPrimary() {
  if (mode !== "gadget" || !activeContext) return;
  if (activeContext.intent === "timer") {
    toggleGadgetTimer();
    return;
  }
  if (activeContext.intent === "rtcfc") {
    if (activeContext.needsStructure) {
      await runRtcfcStructure();
      return;
    }
    await copyRtcfcPrompt();
  }
}

async function onGadgetSecondary() {
  if (mode !== "gadget" || !activeContext) return;
  if (activeContext.intent === "timer") {
    resetGadgetTimer();
    return;
  }
  if (activeContext.intent === "rtcfc") {
    rollRtcfcGadget();
  }
}

async function copyRtcfcPrompt() {
  if (!activeContext || activeContext.intent !== "rtcfc") return;
  const text = Array.isArray(activeContext.lines)
    ? activeContext.lines.join("\n")
    : composeRtcfc(activeContext.rtcfc || {});
  try {
    await navigator.clipboard.writeText(text);
    setStatus(statusEl, "Copied RTCFC prompt", "ok");
  } catch {
    setStatus(statusEl, "Could not copy — select the prompt text manually.", "error");
  }
}

function rollRtcfcGadget() {
  if (!activeContext || activeContext.intent !== "rtcfc") return;
  const next = gadgetFromRtcfc(
    rollRtcfc(activeContext.rtcfc),
    "",
  );
  next.query = composeRtcfc(next.rtcfc);
  activeContext = next;
  setPageContextLocal(next).catch(() => {});
  titleEl.textContent = next.title;
  metaEl.textContent = next.meta;
  overviewExtraLabelEl.textContent = "Prompt";
  renderGadgetBody(next);
  if (btnPrimary) {
    btnPrimary.hidden = false;
    btnPrimary.textContent = "Copy";
  }
  if (btnSecondary) {
    btnSecondary.hidden = false;
    btnSecondary.textContent = "Roll again";
  }
  meanboxHref(gadgetsPath(next.query)).then((href) => {
    if (openEl) openEl.href = href;
  });
  persistGadgetLocal(next).catch(() => {});
  setStatus(statusEl, "Rolled a new RTCFC sample", "ok");
}

/**
 * @param {{ loadToken?: number }} [opts]
 */
async function runRtcfcStructure(opts = {}) {
  if (!activeContext || activeContext.intent !== "rtcfc") return;
  const id = opts.loadToken ?? loadId;
  const text = String(activeContext.query || "").trim();
  if (!text) {
    rollRtcfcGadget();
    setStatus(statusEl, "No freeform text — rolled a sample instead.", "ok");
    return;
  }
  setStatus(statusEl, "Structuring RTCFC…", "loading");
  if (btnPrimary) btnPrimary.disabled = true;
  try {
    const res = await structureRtcfc({ text });
    if (isStale(id)) return;
    if (res?.success === false) {
      throw new Error(
        typeof res.error === "string" ? res.error : "Could not structure prompt",
      );
    }
    const data = res?.data || res;
    const next = gadgetFromRtcfc(
      {
        role: String(data?.role || "").trim(),
        task: String(data?.task || "").trim(),
        context: String(data?.context || "").trim(),
        format: String(data?.format || "").trim(),
        constraints: String(data?.constraints || "").trim(),
      },
      text,
    );
    if (!next.ready) {
      throw new Error(
        typeof res?.error === "string" ? res.error : "Empty RTCFC response",
      );
    }
    next.query = composeRtcfc(next.rtcfc);
    activeContext = next;
    await setPageContextLocal(next);
    if (isStale(id)) return;
    titleEl.textContent = next.title;
    metaEl.textContent = next.meta;
    overviewExtraLabelEl.textContent = "Prompt";
    renderGadgetBody(next);
    if (btnPrimary) {
      btnPrimary.hidden = false;
      btnPrimary.textContent = "Copy";
    }
    if (openEl) openEl.href = await meanboxHref(gadgetsPath(next.query));
    await persistGadgetLocal(next);
    setStatus(statusEl, "RTCFC structured — Copy or open in Meanbox.", "ok");
  } catch (e) {
    if (isStale(id)) return;
    rollRtcfcGadget();
    const msg = e?.message || String(e);
    setStatus(
      statusEl,
      `Structure failed (${msg}) — rolled a local sample instead.`,
      "error",
    );
  } finally {
    if (btnPrimary) btnPrimary.disabled = false;
  }
}

function toggleGadgetTimer() {
  if (mode !== "gadget" || !activeContext || activeContext.intent !== "timer") {
    return;
  }
  if (timerRemaining == null || timerRemaining <= 0) {
    timerRemaining = Number(activeContext.timerSeconds) || 0;
  }
  if (timerRemaining <= 0) return;

  if (timerRunning) {
    stopGadgetTimer(false);
    if (btnPrimary) btnPrimary.textContent = "Start";
    setStatus(statusEl, "Timer paused", "ok");
    return;
  }

  timerRunning = true;
  if (btnPrimary) btnPrimary.textContent = "Pause";
  setStatus(statusEl, "Timer running", "loading");
  timerInterval = setInterval(() => {
    if (timerRemaining == null) return;
    timerRemaining -= 1;
    syncGadgetClock();
    if (timerRemaining <= 0) {
      stopGadgetTimer(false);
      timerRemaining = 0;
      syncGadgetClock();
      if (btnPrimary) btnPrimary.textContent = "Start";
      setStatus(statusEl, "Timer done", "ok");
    }
  }, 1000);
}

function resetGadgetTimer() {
  if (mode !== "gadget" || !activeContext || activeContext.intent !== "timer") {
    return;
  }
  stopGadgetTimer(false);
  timerRemaining = Number(activeContext.timerSeconds) || 0;
  syncGadgetClock();
  if (btnPrimary) btnPrimary.textContent = "Start";
  setStatus(statusEl, "Timer reset", "ok");
}

/**
 * @param {any} ctx
 * @param {number} id
 * @param {boolean} autoRun
 */
async function loadArticle(ctx, id, autoRun) {
  mode = "article";
  emptyEl.hidden = true;
  cardEl.hidden = false;
  if (tabsEl) tabsEl.hidden = true;
  if (tabRelated) tabRelated.hidden = true;
  if (cardFooterEl) cardFooterEl.hidden = true;
  setTab("overview");

  const isLesson = ctx.variant === "lesson";
  eyebrowEl.textContent = isLesson ? "Lesson" : "Article";
  titleEl.textContent = ctx.title || "Untitled";
  let host = "";
  try {
    host = new URL(ctx.canonicalUrl || ctx.pageUrl || "").hostname.replace(
      /^www\./,
      "",
    );
  } catch {
    host = "";
  }
  const excerpt = cleanDescription(ctx.excerpt, 120);
  const titleNorm = String(ctx.title || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const excerptNorm = excerpt.replace(/\s+/g, " ").trim().toLowerCase();
  const titlePrefix = titleNorm.slice(0, Math.min(50, titleNorm.length));
  const excerptPrefix = excerptNorm.slice(0, Math.min(50, excerptNorm.length));
  const showExcerpt =
    Boolean(excerpt && excerptNorm) &&
    excerptNorm !== titleNorm &&
    !(titlePrefix && excerptNorm.startsWith(titlePrefix)) &&
    !(excerptPrefix && titleNorm.startsWith(excerptPrefix));
  metaEl.textContent = joinMeta(host || null, showExcerpt ? excerpt : null);

  badgesEl.replaceChildren();
  btnPrimary.hidden = false;
  btnPrimary.textContent = "Deep dive";
  btnSecondary.hidden = true;
  setStatus(statusEl, "", "idle");

  if (ctx.storyId && openEl && cardFooterEl) {
    openEl.href = await meanboxHref(
      `/news?story=${encodeURIComponent(ctx.storyId)}`,
    );
    cardFooterEl.hidden = false;
  }

  const articleKey = articleDedupeKey(ctx.canonicalUrl || ctx.pageUrl);
  if (articleKey) {
    try {
      const { apiBase } = await getSettings();
      const local = await getLocalItem("news_deep_dive", articleKey, apiBase);
      const text =
        local?.payload && typeof local.payload.text === "string"
          ? local.payload.text.trim()
          : "";
      if (text) {
        if (isStale(id)) return;
        overviewExtraEl.hidden = false;
        overviewExtraLabelEl.textContent = "Deep dive";
        setPlainText(overviewExtraBodyEl, text);
        renderSources(local.payload.sources || []);
        articleHasDeepDive = true;
        btnPrimary.textContent = "Regenerate";
        setStatus(statusEl, "Deep dive loaded from this device", "ok");
        if (local.payload.storyId && openEl && cardFooterEl) {
          openEl.href = await meanboxHref(
            `/news?story=${encodeURIComponent(String(local.payload.storyId))}`,
          );
          cardFooterEl.hidden = false;
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (autoRun) {
    await browser.storage.session.set({ pendingDeepDive: false });
    await runDeepDive({ force: false, loadToken: id });
  }
}

/**
 * @param {{ force?: boolean, loadToken?: number }} [opts]
 */
async function runDeepDive(opts = {}) {
  const id = opts.loadToken ?? loadId;
  if (btnPrimary) btnPrimary.disabled = true;
  setStatus(statusEl, "Reading page…", "loading");
  setTab("overview");

  try {
    const refreshed = await refreshArticleFromActiveTab();
    if (isStale(id)) return;
    if (refreshed) {
      if (mode !== "article" || !cardEl || cardEl.hidden) {
        await loadArticle(refreshed, id, false);
        if (isStale(id)) return;
      } else {
        activeContext = refreshed;
        titleEl.textContent = refreshed.title || "Untitled";
      }
    }

    if (!activeContext || activeContext.kind !== "article") {
      setStatus(
        statusEl,
        "Could not read this page — grant host access in Options, or open an https page.",
        "error",
      );
      return;
    }

    setStatus(statusEl, "Saving article…", "loading");

    const title = activeContext.title || "";
    const excerpt = activeContext.excerpt || "";
    const canonicalUrl =
      activeContext.canonicalUrl || activeContext.pageUrl || "";

    let storyId =
      typeof activeContext.storyId === "string" ? activeContext.storyId.trim() : "";
    let saveWarning = "";
    if (!storyId) {
      try {
        const clipped = await clipNewsArticle({ title, excerpt, canonicalUrl });
        if (isStale(id)) return;
        storyId = typeof clipped?.id === "string" ? clipped.id.trim() : "";
        if (!storyId) {
          throw new Error(clipped?.error || "Could not save article to Meanbox");
        }
        activeContext = { ...activeContext, storyId };
        await setPageContextLocal(activeContext);
      } catch (clipErr) {
        if (isStale(id)) return;
        const clipMsg = clipErr?.message || String(clipErr);
        const status = clipErr?.status;
        if (status === 404 || /HTTP 404/i.test(clipMsg)) {
          saveWarning =
            "Clip API not on this API host yet (deploy /api/news/clip). Showing unsaved deep dive.";
        } else {
          throw clipErr;
        }
      }
    }

    setStatus(statusEl, "Generating deep dive…", "loading");
    const res = await generateNewsDeepDive({
      title,
      excerpt,
      canonicalUrl,
      ...(storyId ? { id: storyId } : {}),
      force: Boolean(opts.force),
    });
    if (isStale(id)) return;
    overviewExtraEl.hidden = false;
    overviewExtraLabelEl.textContent = "Deep dive";
    setPlainText(overviewExtraBodyEl, res.text || "");
    renderSources(res.sources || []);
    articleHasDeepDive = true;
    if (btnPrimary) btnPrimary.textContent = "Regenerate";

    const articleKey = articleDedupeKey(canonicalUrl);
    let localDeepDiveItem = null;
    if (articleKey) {
      localDeepDiveItem = await persistLocal("news_deep_dive", articleKey, {
        canonicalUrl,
        title,
        excerpt,
        text: res.text || "",
        sources: res.sources || [],
        storyId: storyId || "",
      });
      if (res.persisted && localDeepDiveItem?.id) {
        await markSynced(localDeepDiveItem.id);
      }
    }

    if (storyId && openEl && cardFooterEl) {
      openEl.href = await meanboxHref(
        `/news?story=${encodeURIComponent(storyId)}`,
      );
      cardFooterEl.hidden = false;
    }

    if (saveWarning) {
      setStatus(
        statusEl,
        `${saveWarning} ${formatLocalSaveHint()}`,
        "ok",
      );
    } else if (res.persisted) {
      setStatus(
        statusEl,
        res.cached ? "Saved (cached) — open in Meanbox anytime" : "Saved to Meanbox",
        "ok",
      );
    } else if (await hasMeanboxSession()) {
      setStatus(
        statusEl,
        "Deep dive ready, but not saved — check Inspired Canvas env on the API host.",
        "error",
      );
    } else {
      setStatus(statusEl, formatLocalSaveHint(), "ok");
    }
  } catch (e) {
    if (isStale(id)) return;
    const msg = e?.message || String(e);
    if (e?.status === 404 || /HTTP 404/i.test(msg)) {
      setStatus(
        statusEl,
        "API returned 404 — deploy Meanbox with /api/news/clip, or point Options → API base to a host that has it.",
        "error",
      );
      return;
    }
    const hint =
      /host|permission|NetworkError|Failed to fetch|Inspired Canvas|auth/i.test(
        msg,
      )
        ? `${msg} — Options → Grant host access; API needs INSPIRED_CANVAS_* env.`
        : msg;
    setStatus(statusEl, hint, "error");
  } finally {
    if (btnPrimary) btnPrimary.disabled = false;
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
  if (openEl) {
    openEl.href = await meanboxHref(
      `/github?repo=${encodeURIComponent(repoCard.fullName)}`,
    );
  }
  if (cardFooterEl) cardFooterEl.hidden = false;
  if (tabsEl) tabsEl.hidden = false;

  try {
    const { apiBase } = await getSettings();
    const local = await getLocalItem(
      "repo_summary",
      repoCard.fullName,
      apiBase,
    );
    if (isStale(id)) return;
    const text =
      local?.payload && typeof local.payload.text === "string"
        ? local.payload.text.trim()
        : "";
    if (text) {
      overviewExtraEl.hidden = false;
      overviewExtraLabelEl.textContent = "Summary";
      setPlainText(overviewExtraBodyEl, text);
      setStatus(statusEl, "Summary loaded from this device", "ok");
    } else {
      setStatus(statusEl, "", "idle");
    }
  } catch {
    setStatus(statusEl, "", "idle");
  }
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
  if (openEl) {
    openEl.href = await meanboxHref(
      `/youtube?videoId=${encodeURIComponent(videoCard.videoId || videoId)}`,
    );
  }
  if (cardFooterEl) cardFooterEl.hidden = false;
  if (tabsEl) tabsEl.hidden = false;

  overviewExtraEl.hidden = true;
  setPlainText(overviewExtraBodyEl, "");
  setStatus(statusEl, "", "idle");

  // Restore saved pack when the user already generated one for this video.
  try {
    const saved = await fetchSavedLearningPack(videoCard.videoId || videoId);
    if (isStale(id)) return;
    const md =
      saved?.pack && typeof saved.pack.markdown === "string"
        ? saved.pack.markdown.trim()
        : "";
    if (md) {
      overviewExtraEl.hidden = false;
      overviewExtraLabelEl.textContent = "Learning pack";
      setPlainText(overviewExtraBodyEl, md);
      setStatus(statusEl, "Pack loaded", "ok");
    } else {
      const { apiBase } = await getSettings();
      const local = await getLocalItem("learning_pack", videoId, apiBase);
      const localMd =
        local?.payload && typeof local.payload.markdown === "string"
          ? local.payload.markdown.trim()
          : "";
      if (localMd) {
        overviewExtraEl.hidden = false;
        overviewExtraLabelEl.textContent = "Learning pack";
        setPlainText(overviewExtraBodyEl, localMd);
        setStatus(statusEl, "Pack loaded from this device", "ok");
      } else if (
        saved?._sessionBridge?.reason === "ok" &&
        !saved.unauthorized
      ) {
        setStatus(statusEl, "No saved pack yet", "idle");
      }
    }
  } catch {
    try {
      const { apiBase } = await getSettings();
      const local = await getLocalItem("learning_pack", videoId, apiBase);
      const localMd =
        local?.payload && typeof local.payload.markdown === "string"
          ? local.payload.markdown.trim()
          : "";
      if (localMd && !isStale(id)) {
        overviewExtraEl.hidden = false;
        overviewExtraLabelEl.textContent = "Learning pack";
        setPlainText(overviewExtraBodyEl, localMd);
        setStatus(statusEl, "Pack loaded from this device", "ok");
      }
    } catch {
      /* keep idle — generate still available */
    }
  }
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
  await persistLocal("repo_summary", repoCard.fullName, {
    fullName: repoCard.fullName,
    text: res.text || "",
    description: repoCard.description || "",
  });
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

  const localItem = await persistLocal("learning_pack", videoId, {
    videoId,
    title,
    channelTitle: videoCard?.channelTitle || "",
    markdown: pack.text || "",
    transcript: tr.text,
    contentType: "lecture",
  });

  if (pack.saved) {
    if (localItem?.id) await markSynced(localItem.id);
    setStatus(
      statusEl,
      pack.cached ? "Pack saved (cached)" : "Pack saved to history",
      "ok",
    );
    return;
  }

  if (pack.saveError) {
    setStatus(
      statusEl,
      `${formatUnsavedPackHint({
        saveError: pack.saveError,
        sessionBridge: pack._sessionBridge,
        apiBase: pack._apiBase,
      })} ${formatLocalSaveHint()}`,
      "ok",
    );
    return;
  }

  setStatus(statusEl, formatLocalSaveHint(), "ok");
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
