import { mergeArticleWithQuery } from "./lib/article.js";
import { meanboxHref } from "./lib/config.js";
import { resolveQuickGadget } from "./lib/gadgets.js";
import { gadgetsPath, placesPath } from "./lib/paths.js";
import { setStatus } from "./lib/ui.js";

const statusEl = document.getElementById("status");
const tagEl = document.getElementById("context-tag");
const cardEl = document.getElementById("context-card");
const titleEl = document.getElementById("context-title");
const metaEl = document.getElementById("context-meta");
const actionsEl = document.getElementById("context-actions");
const form = document.getElementById("search-form");
const qInput = document.getElementById("search-q");

/** @type {"github" | "youtube" | "gadgets" | "news" | "places"} */
let searchTarget = "github";

document.getElementById("btn-gh")?.addEventListener("click", () => {
  searchTarget = "github";
  highlightTarget();
});
document.getElementById("btn-yt")?.addEventListener("click", () => {
  searchTarget = "youtube";
  highlightTarget();
});
document.getElementById("btn-gadgets")?.addEventListener("click", () => {
  searchTarget = "gadgets";
  highlightTarget();
});
document.getElementById("btn-news")?.addEventListener("click", () => {
  searchTarget = "news";
  highlightTarget();
});
document.getElementById("btn-places")?.addEventListener("click", () => {
  searchTarget = "places";
  highlightTarget();
});
document.getElementById("btn-sidebar")?.addEventListener("click", async () => {
  // sidePanel.open requires a user gesture in this document — do not relay via SW.
  try {
    const win = await chrome.windows.getCurrent();
    if (win?.id != null) {
      await chrome.sidePanel.open({ windowId: win.id });
      return;
    }
  } catch {
    /* fall through */
  }
  chrome.runtime.sendMessage({ type: "open-sidebar" }).catch(() => {});
});
document.getElementById("btn-options")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = qInput.value.trim();
  if (searchTarget !== "gadgets" && q.length < 2) {
    setStatus(statusEl, "Enter at least 2 characters", "error");
    return;
  }
  if (searchTarget === "news") {
    const extracted = await chrome.runtime.sendMessage({
      type: "extract-active-article",
      force: true,
    });
    const ctx = mergeArticleWithQuery(extracted?.context, q);
    if (!ctx) {
      setStatus(
        statusEl,
        "Enter a topic or open a page (grant host access in Options).",
        "error",
      );
      return;
    }
    await chrome.runtime.sendMessage({
      type: "open-article-deep-dive",
      context: ctx,
      autoRun: true,
    });
    window.close();
    return;
  }
  let path;
  if (searchTarget === "youtube") {
    path = `/youtube?q=${encodeURIComponent(q.slice(0, 200))}`;
  } else if (searchTarget === "gadgets") {
    const quick = resolveQuickGadget(q);
    if (quick) {
      await chrome.runtime.sendMessage({
        type: "open-quick-gadget",
        context: quick,
      });
      window.close();
      return;
    }
    path = gadgetsPath(q);
  } else if (searchTarget === "places") {
    path = placesPath(q);
  } else {
    path = `/github?q=${encodeURIComponent(q.slice(0, 100))}`;
  }
  const url = await meanboxHref(path);
  await chrome.tabs.create({ url });
  window.close();
});

function highlightTarget() {
  const map = {
    github: "btn-gh",
    youtube: "btn-yt",
    gadgets: "btn-gadgets",
    news: "btn-news",
    places: "btn-places",
  };
  for (const [key, id] of Object.entries(map)) {
    document.getElementById(id)?.classList.toggle("primary", searchTarget === key);
  }
  if (qInput) {
    const placeholders = {
      github: "Search GitHub…",
      youtube: "Search YouTube…",
      gadgets: "tip 18% · 25 min focus · rtcfc review PR…",
      news: "Topic or headline for deep dive…",
      places: "Place or address…",
    };
    qInput.placeholder = placeholders[searchTarget] || "Search Meanbox…";
  }
}

async function loadContext() {
  const res = await chrome.runtime.sendMessage({ type: "get-page-context" });
  const ctx = res?.context;
  if (!ctx) {
    tagEl.textContent = "No page match";
    cardEl.hidden = true;
    return;
  }

  cardEl.hidden = false;
  actionsEl.replaceChildren();

  if (ctx.kind === "github") {
    tagEl.textContent = "GitHub";
    searchTarget = "github";
    titleEl.textContent = ctx.fullName;
    metaEl.textContent = ctx.url;
    addAction("Open in Meanbox", `/github?repo=${encodeURIComponent(ctx.fullName)}`);
  } else if (ctx.kind === "youtube") {
    tagEl.textContent = "YouTube";
    searchTarget = "youtube";
    titleEl.textContent = `Video ${ctx.videoId}`;
    metaEl.textContent = ctx.url;
    addAction("Study in Meanbox", `/youtube?videoId=${encodeURIComponent(ctx.videoId)}`);
  } else if (ctx.kind === "article") {
    tagEl.textContent = ctx.variant === "lesson" ? "Lesson" : "Article";
    searchTarget = "news";
    titleEl.textContent = ctx.title || "Untitled";
    metaEl.textContent = ctx.canonicalUrl || ctx.pageUrl || "";
    addAction("Deep dive", null, () =>
      chrome.runtime.sendMessage({
        type: "open-article-deep-dive",
        context: ctx,
        autoRun: true,
      }),
    );
  }
  highlightTarget();
}

/**
 * @param {string} label
 * @param {string | null} path
 * @param {(() => void) | null} [onClick]
 */
function addAction(label, path, onClick = null) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.classList.add("primary");
  btn.addEventListener("click", async () => {
    if (onClick) {
      onClick();
      window.close();
      return;
    }
    if (!path) return;
    const url = await meanboxHref(path);
    await chrome.tabs.create({ url });
    window.close();
  });
  actionsEl.appendChild(btn);
}

highlightTarget();
loadContext().catch((e) => setStatus(statusEl, e.message || String(e), "error"));
