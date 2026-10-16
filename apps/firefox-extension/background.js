/**
 * Meanbox background event page — menus, omnibox, page context sync.
 */

import {
  analyzePageFields,
  buildArticlePageContext,
  buildForcedArticleContext,
  gatherPageFieldsInTab,
  isExcludedArticleUrl,
  syntheticArticleContext,
} from "./lib/article.js";
import { SESSION_COOKIE_PREFIX } from "./lib/api.js";
import { meanboxHref } from "./lib/config.js";
import { syncPendingLocalHistory } from "./lib/syncLocalHistory.js";
import { resolveQuickGadget } from "./lib/gadgets.js";
import { parseGitHubRepoUrl, parsePageContext, parseYouTubeVideoUrl } from "./lib/parse.js";
import { gadgetsPath, placesPath, resolveOmniboxPath } from "./lib/paths.js";

const MENU = {
  openRepo: "meanbox-open-repo",
  openVideo: "meanbox-open-video",
  searchSelectionGithub: "meanbox-search-selection-github",
  searchSelectionYoutube: "meanbox-search-selection-youtube",
  openSelectionGadgets: "meanbox-open-selection-gadgets",
  clipSelectionNews: "meanbox-clip-selection-news",
  clipPageNews: "meanbox-clip-page-news",
  placesSelection: "meanbox-places-selection",
  studyLink: "meanbox-study-link",
  advisoriesLink: "meanbox-advisories-link",
};

/** @type {any} */
let lastContext = null;

browser.runtime.onInstalled.addListener(() => {
  setupMenus();
  syncPendingLocalHistory().catch(() => {});
});

if (browser.runtime.onStartup) {
  browser.runtime.onStartup.addListener(() => {
    syncPendingLocalHistory().catch(() => {});
  });
}

syncPendingLocalHistory().catch(() => {});

if (browser.cookies?.onChanged) {
  browser.cookies.onChanged.addListener((changeInfo) => {
    if (changeInfo.removed) return;
    const name = changeInfo.cookie?.name || "";
    if (!name.startsWith(SESSION_COOKIE_PREFIX)) return;
    syncPendingLocalHistory().catch(() => {});
  });
}

setupMenus();

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    syncContextFromTab(tab).catch(() => {});
  }
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await browser.tabs.get(tabId);
    await syncContextFromTab(tab);
  } catch {
    /* ignore */
  }
});

browser.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg !== "object") return undefined;

  if (msg.type === "page-context") {
    lastContext = msg.context || null;
    browser.storage.session.set({ pageContext: lastContext }).catch(() => {});
    updateActionBadge(lastContext).catch(() => {});
    return Promise.resolve({ ok: true });
  }

  if (msg.type === "get-page-context") {
    return browser.storage.session
      .get("pageContext")
      .then((s) => ({ context: s.pageContext || lastContext }));
  }

  if (msg.type === "open-meanbox") {
    return meanboxHref(msg.path || "/").then((url) =>
      browser.tabs.create({ url }).then(() => ({ ok: true })),
    );
  }

  if (msg.type === "sync-local-history") {
    return syncPendingLocalHistory();
  }

  if (msg.type === "open-sidebar") {
    return openSidebar().then((ok) => ({ ok }));
  }

  if (msg.type === "open-article-deep-dive") {
    return openArticleDeepDive(msg.context, {
      autoRun: Boolean(msg.autoRun),
    }).then((ok) => ({ ok }));
  }

  if (msg.type === "open-quick-gadget") {
    return openQuickGadget(msg.context).then((ok) => ({ ok }));
  }

  if (msg.type === "extract-active-article") {
    return extractArticleFromActiveTab({
      selection: typeof msg.selection === "string" ? msg.selection : "",
      force: Boolean(msg.force),
    }).then((context) => ({ context }));
  }

  return undefined;
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const linkUrl = info.linkUrl || "";
  const pageUrl = info.pageUrl || tab?.url || "";
  const selection = (info.selectionText || "").trim();
  const pageTitle = (tab?.title || "").trim();

  try {
    switch (info.menuItemId) {
      case MENU.openRepo: {
        const ctx = parseGitHubRepoUrl(pageUrl);
        if (ctx) {
          await openPath(`/github?repo=${encodeURIComponent(ctx.fullName)}`);
        }
        break;
      }
      case MENU.openVideo: {
        const ctx = parseYouTubeVideoUrl(pageUrl);
        if (ctx) {
          await openPath(`/youtube?videoId=${encodeURIComponent(ctx.videoId)}`);
        }
        break;
      }
      case MENU.searchSelectionGithub: {
        if (selection.length >= 2) {
          await openPath(`/github?q=${encodeURIComponent(selection.slice(0, 100))}`);
        }
        break;
      }
      case MENU.searchSelectionYoutube: {
        if (selection.length >= 2) {
          await openPath(`/youtube?q=${encodeURIComponent(selection.slice(0, 200))}`);
        }
        break;
      }
      case MENU.openSelectionGadgets: {
        if (selection.length >= 1) {
          const quick = resolveQuickGadget(selection);
          if (quick) {
            await openQuickGadget(quick);
          } else {
            await openPath(gadgetsPath(selection));
          }
        }
        break;
      }
      case MENU.clipSelectionNews: {
        if (selection.length >= 2) {
          const extracted = await extractArticleFromTab(tab, {
            selection,
            force: true,
          });
          const ctx =
            extracted ||
            syntheticArticleContext({
              title: pageTitle || selection.slice(0, 120),
              excerpt: selection,
              canonicalUrl: pageUrl,
            });
          if (ctx) await openArticleDeepDive(ctx, { autoRun: true });
        }
        break;
      }
      case MENU.clipPageNews: {
        const extracted = await extractArticleFromTab(tab, {
          selection,
          force: true,
        });
        const ctx =
          extracted ||
          syntheticArticleContext({
            title: pageTitle || pageUrl,
            excerpt: selection.length >= 2 ? selection : pageTitle || pageUrl,
            canonicalUrl: pageUrl,
          });
        if (ctx) await openArticleDeepDive(ctx, { autoRun: true });
        break;
      }
      case MENU.placesSelection: {
        if (selection.length >= 2) {
          await openPath(placesPath(selection));
        }
        break;
      }
      case MENU.studyLink: {
        const yt = parseYouTubeVideoUrl(linkUrl);
        if (yt) {
          await openPath(`/youtube?videoId=${encodeURIComponent(yt.videoId)}`);
        }
        break;
      }
      case MENU.advisoriesLink:
      case `${MENU.advisoriesLink}-page`: {
        const gh = parseGitHubRepoUrl(linkUrl || pageUrl);
        if (gh) {
          await openPath(`/github?repo=${encodeURIComponent(gh.fullName)}`);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.warn("[meanbox] menu action failed", e);
  }
});

browser.omnibox.setDefaultSuggestion({
  description:
    "Meanbox — gh:… yt:… g:… news:… places:… or free text",
});

browser.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const raw = String(text || "").trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith("news:")) {
    const q = raw.replace(/^news:\s*/i, "").trim();
    const ctx = syntheticArticleContext({ title: q, excerpt: q });
    if (ctx) {
      await openArticleDeepDive(ctx, { autoRun: true });
    }
    return;
  }
  if (
    lower.startsWith("g:") ||
    lower.startsWith("gadget:") ||
    lower.startsWith("gadgets:")
  ) {
    const q = raw.replace(/^(g|gadget|gadgets):\s*/i, "").trim();
    const quick = resolveQuickGadget(q);
    if (quick) {
      await openQuickGadget(quick);
      return;
    }
  }

  const path = resolveOmniboxPath(text);
  const url = await meanboxHref(path);
  const props = { url };
  if (disposition === "currentTab") {
    await browser.tabs.update(props);
  } else {
    await browser.tabs.create(props);
  }
});

function setupMenus() {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: MENU.openRepo,
      title: "Open repo in Meanbox",
      contexts: ["page"],
      documentUrlPatterns: ["https://github.com/*", "https://www.github.com/*"],
    });
    browser.contextMenus.create({
      id: MENU.advisoriesLink,
      title: "Check advisories in Meanbox",
      contexts: ["link"],
      targetUrlPatterns: ["https://github.com/*/*", "https://www.github.com/*/*"],
    });
    browser.contextMenus.create({
      id: `${MENU.advisoriesLink}-page`,
      title: "Check advisories in Meanbox",
      contexts: ["page"],
      documentUrlPatterns: ["https://github.com/*", "https://www.github.com/*"],
    });
    browser.contextMenus.create({
      id: MENU.openVideo,
      title: "Study video in Meanbox",
      contexts: ["page"],
      documentUrlPatterns: [
        "https://www.youtube.com/*",
        "https://youtube.com/*",
        "https://m.youtube.com/*",
      ],
    });
    browser.contextMenus.create({
      id: MENU.studyLink,
      title: "Study with Meanbox",
      contexts: ["link"],
      targetUrlPatterns: [
        "https://www.youtube.com/*",
        "https://youtube.com/*",
        "https://youtu.be/*",
        "https://m.youtube.com/*",
      ],
    });
    browser.contextMenus.create({
      id: MENU.searchSelectionGithub,
      title: "Search selection on Meanbox GitHub",
      contexts: ["selection"],
    });
    browser.contextMenus.create({
      id: MENU.searchSelectionYoutube,
      title: "Search selection on Meanbox YouTube",
      contexts: ["selection"],
    });
    browser.contextMenus.create({
      id: MENU.openSelectionGadgets,
      title: "Quick Gadgets from selection",
      contexts: ["selection"],
    });
    browser.contextMenus.create({
      id: MENU.clipSelectionNews,
      title: "Deep dive selection in Meanbox",
      contexts: ["selection"],
    });
    browser.contextMenus.create({
      id: MENU.clipPageNews,
      title: "Deep dive this page in Meanbox",
      contexts: ["page"],
    });
    browser.contextMenus.create({
      id: MENU.placesSelection,
      title: "Find place in Meanbox",
      contexts: ["selection"],
    });
  });
}

/**
 * @param {browser.tabs.Tab | undefined} tab
 */
async function syncContextFromTab(tab) {
  if (!tab?.url) return;
  const parsed = parsePageContext(tab.url);
  if (parsed) {
    lastContext = parsed;
    await browser.storage.session.set({ pageContext: parsed, pendingDeepDive: false });
    await updateActionBadge(parsed);
    return;
  }

  const article = await extractArticleFromTab(tab, { force: false });
  lastContext = article;
  await browser.storage.session.set({
    pageContext: article,
    pendingDeepDive: false,
  });
  await updateActionBadge(article);
}

/**
 * @param {{ selection?: string, force?: boolean }} [opts]
 */
async function extractArticleFromActiveTab(opts = {}) {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return extractArticleFromTab(tabs[0], opts);
}

/**
 * @param {browser.tabs.Tab | undefined} tab
 * @param {{ selection?: string, force?: boolean }} [opts]
 */
async function extractArticleFromTab(tab, opts = {}) {
  const pageUrl = tab?.url || "";
  if (!pageUrl || !/^https?:/i.test(pageUrl)) return null;
  if (parsePageContext(pageUrl)) return null;
  if (isExcludedArticleUrl(pageUrl) && !opts.force) return null;

  const selection = typeof opts.selection === "string" ? opts.selection.trim() : "";

  try {
    if (typeof browser.scripting?.executeScript !== "function" || tab?.id == null) {
      if (opts.force) {
        return syntheticArticleContext({
          title: (tab?.title || "").trim() || pageUrl,
          excerpt: selection || (tab?.title || "").trim() || pageUrl,
          canonicalUrl: pageUrl,
        });
      }
      return null;
    }

    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: gatherPageFieldsInTab,
    });
    const fields = results?.[0]?.result;
    if (!fields || typeof fields !== "object") {
      if (opts.force) {
        return syntheticArticleContext({
          title: (tab?.title || "").trim() || pageUrl,
          excerpt: selection || (tab?.title || "").trim() || pageUrl,
          canonicalUrl: pageUrl,
        });
      }
      return null;
    }

    if (selection.length >= 2) {
      fields.selection = selection;
    }

    const analyzed = analyzePageFields(fields);
    if (analyzed) return buildArticlePageContext(analyzed);

    if (opts.force) {
      return (
        buildForcedArticleContext({
          ...fields,
          pageUrl: fields.pageUrl || pageUrl,
          title: fields.title || (tab?.title || "").trim() || pageUrl,
          selection: selection || fields.selection || "",
        }) ||
        syntheticArticleContext({
          title: fields.title || (tab?.title || "").trim() || pageUrl,
          excerpt:
            selection ||
            fields.mainText ||
            fields.ogDescription ||
            fields.metaDescription ||
            fields.title ||
            pageUrl,
          canonicalUrl: fields.canonical || pageUrl,
        })
      );
    }
    return null;
  } catch {
    // Missing host permission or restricted page.
    if (opts.force) {
      return syntheticArticleContext({
        title: (tab?.title || "").trim() || pageUrl,
        excerpt: selection || (tab?.title || "").trim() || pageUrl,
        canonicalUrl: pageUrl,
      });
    }
    return null;
  }
}

/**
 * @param {any} context
 * @param {{ autoRun?: boolean }} [opts]
 */
async function openArticleDeepDive(context, opts = {}) {
  if (!context || context.kind !== "article") return false;
  lastContext = context;
  await browser.storage.session.set({
    pageContext: context,
    pendingDeepDive: Boolean(opts.autoRun),
  });
  await updateActionBadge(context);
  return openSidebar();
}

/**
 * @param {any} context
 */
async function openQuickGadget(context) {
  if (!context || context.kind !== "gadget") return false;
  lastContext = context;
  await browser.storage.session.set({
    pageContext: context,
    pendingDeepDive: false,
  });
  await updateActionBadge(context);
  return openSidebar();
}

async function openSidebar() {
  try {
    if (browser.sidebarAction?.open) {
      await browser.sidebarAction.open();
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * @param {any} context
 */
async function updateActionBadge(context) {
  try {
    if (context?.kind === "github") {
      await browser.action.setBadgeText({ text: "GH" });
      await browser.action.setBadgeBackgroundColor({ color: "#238636" });
      await browser.action.setTitle({ title: `Meanbox · ${context.fullName}` });
    } else if (context?.kind === "youtube") {
      await browser.action.setBadgeText({ text: "YT" });
      await browser.action.setBadgeBackgroundColor({ color: "#c00" });
      await browser.action.setTitle({ title: `Meanbox · ${context.videoId}` });
    } else if (context?.kind === "article") {
      await browser.action.setBadgeText({
        text: context.variant === "lesson" ? "LN" : "DD",
      });
      await browser.action.setBadgeBackgroundColor({ color: "#1d4ed8" });
      const label = context.title
        ? String(context.title).slice(0, 60)
        : "Deep dive";
      await browser.action.setTitle({ title: `Meanbox · ${label}` });
    } else if (context?.kind === "gadget") {
      const short =
        context.intent === "tip"
          ? "TP"
          : context.intent === "split"
            ? "SP"
            : context.intent === "convert"
              ? "CV"
              : context.intent === "timer"
                ? "TM"
                : context.intent === "rtcfc"
                  ? "RF"
                  : "G";
      await browser.action.setBadgeText({ text: short });
      await browser.action.setBadgeBackgroundColor({ color: "#0f766e" });
      const label = context.title
        ? String(context.title).slice(0, 60)
        : "Gadget";
      await browser.action.setTitle({ title: `Meanbox · ${label}` });
    } else {
      await browser.action.setBadgeText({ text: "" });
      await browser.action.setTitle({ title: "Meanbox" });
    }
  } catch {
    /* action may be unavailable in some contexts */
  }
}

/** @param {string} path */
async function openPath(path) {
  const url = await meanboxHref(path);
  await browser.tabs.create({ url });
}
