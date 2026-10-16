/**
 * Detect GitHub repo / YouTube video pages and sync context to the background.
 * Injects a small "Meanbox" chip that opens the sidebar / popup flow.
 */
(() => {
  const CHIP_ID = "meanbox-ext-chip";
  let lastKey = "";

  function isVideoId(id) {
    return typeof id === "string" && /^[\w-]{11}$/.test(id);
  }

  function parseGitHubRepoUrl(href) {
    let u;
    try {
      u = new URL(href);
    } catch {
      return null;
    }
    if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
    const m = u.pathname.match(
      /^\/([^/]+)\/([^/]+)(?:\/(tree|blob|issues|pull|actions|security|releases|wiki|projects|settings|pulse|graphs|network|forks)(?:\/|$))?/i,
    );
    if (!m) return null;
    const owner = m[1];
    const name = m[2];
    const blocked = new Set([
      "settings",
      "marketplace",
      "explore",
      "notifications",
      "orgs",
      "topics",
      "search",
      "login",
      "signup",
      "features",
      "pricing",
      "about",
    ]);
    if (!owner || !name || blocked.has(owner) || blocked.has(name)) return null;
    return {
      kind: "github",
      owner,
      name,
      fullName: `${owner}/${name}`,
      url: `https://github.com/${owner}/${name}`,
    };
  }

  function parseYouTubeVideoUrl(href) {
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
    return null;
  }

  function currentContext() {
    return parseGitHubRepoUrl(location.href) || parseYouTubeVideoUrl(location.href);
  }

  function contextKey(ctx) {
    if (!ctx) return "";
    return ctx.kind === "github" ? `gh:${ctx.fullName}` : `yt:${ctx.videoId}`;
  }

  function ensureChip(ctx) {
    let chip = document.getElementById(CHIP_ID);
    if (!ctx) {
      chip?.remove();
      return;
    }
    if (!chip) {
      chip = document.createElement("button");
      chip.id = CHIP_ID;
      chip.type = "button";
      chip.className = "meanbox-chip";
      chip.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "open-sidebar" }).catch(() => {
          chrome.runtime.sendMessage({ type: "page-context", context: currentContext() });
        });
      });
      document.documentElement.appendChild(chip);
    }
    chip.textContent =
      ctx.kind === "github" ? `Meanbox · ${ctx.fullName}` : "Meanbox · Study";
    chip.title =
      ctx.kind === "github"
        ? "Open Meanbox sidebar for this repository"
        : "Open Meanbox sidebar for this video";
  }

  function publish() {
    const ctx = currentContext();
    const key = contextKey(ctx);
    if (key === lastKey) {
      ensureChip(ctx);
      return;
    }
    lastKey = key;
    ensureChip(ctx);
    chrome.runtime.sendMessage({ type: "page-context", context: ctx }).catch(() => {});
  }

  // SPA navigation hooks (GitHub + YouTube)
  const _push = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState = function (...args) {
    const r = _push(...args);
    queueMicrotask(publish);
    return r;
  };
  history.replaceState = function (...args) {
    const r = _replace(...args);
    queueMicrotask(publish);
    return r;
  };
  window.addEventListener("popstate", publish);
  window.addEventListener("yt-navigate-finish", publish);

  publish();
  setInterval(publish, 2000);
})();
