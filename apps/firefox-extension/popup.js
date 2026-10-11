import { meanboxHref } from "./lib/config.js";
import { setStatus } from "./lib/ui.js";

const statusEl = document.getElementById("status");
const tagEl = document.getElementById("context-tag");
const cardEl = document.getElementById("context-card");
const titleEl = document.getElementById("context-title");
const metaEl = document.getElementById("context-meta");
const actionsEl = document.getElementById("context-actions");
const form = document.getElementById("search-form");
const qInput = document.getElementById("search-q");

/** @type {"github" | "youtube"} */
let searchTarget = "github";

document.getElementById("btn-gh")?.addEventListener("click", () => {
  searchTarget = "github";
  highlightTarget();
});
document.getElementById("btn-yt")?.addEventListener("click", () => {
  searchTarget = "youtube";
  highlightTarget();
});
document.getElementById("btn-sidebar")?.addEventListener("click", () => {
  browser.runtime.sendMessage({ type: "open-sidebar" });
});
document.getElementById("btn-options")?.addEventListener("click", () => {
  browser.runtime.openOptionsPage();
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = qInput.value.trim();
  if (q.length < 2) {
    setStatus(statusEl, "Enter at least 2 characters", "error");
    return;
  }
  const path =
    searchTarget === "youtube"
      ? `/youtube?q=${encodeURIComponent(q.slice(0, 200))}`
      : `/github?q=${encodeURIComponent(q.slice(0, 100))}`;
  const url = await meanboxHref(path);
  await browser.tabs.create({ url });
  window.close();
});

function highlightTarget() {
  document.getElementById("btn-gh")?.classList.toggle("primary", searchTarget === "github");
  document.getElementById("btn-yt")?.classList.toggle("primary", searchTarget === "youtube");
}

async function loadContext() {
  const res = await browser.runtime.sendMessage({ type: "get-page-context" });
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
    addAction("Open sidebar", null, () =>
      browser.runtime.sendMessage({ type: "open-sidebar" }),
    );
  } else if (ctx.kind === "youtube") {
    tagEl.textContent = "YouTube";
    searchTarget = "youtube";
    titleEl.textContent = `Video ${ctx.videoId}`;
    metaEl.textContent = ctx.url;
    addAction("Study in Meanbox", `/youtube?videoId=${encodeURIComponent(ctx.videoId)}`);
    addAction("Open sidebar", null, () =>
      browser.runtime.sendMessage({ type: "open-sidebar" }),
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
  if (path) btn.classList.add("primary");
  btn.addEventListener("click", async () => {
    if (onClick) {
      onClick();
      return;
    }
    if (!path) return;
    const url = await meanboxHref(path);
    await browser.tabs.create({ url });
    window.close();
  });
  actionsEl.appendChild(btn);
}

highlightTarget();
loadContext().catch((e) => setStatus(statusEl, e.message || String(e), "error"));
