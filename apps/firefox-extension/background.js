/**
 * Meanbox background event page — menus, omnibox, page context sync.
 */

import { meanboxHref } from "./lib/config.js";
import { parseGitHubRepoUrl, parsePageContext, parseYouTubeVideoUrl } from "./lib/parse.js";

const MENU = {
  openRepo: "meanbox-open-repo",
  openVideo: "meanbox-open-video",
  searchSelectionGithub: "meanbox-search-selection-github",
  searchSelectionYoutube: "meanbox-search-selection-youtube",
  studyLink: "meanbox-study-link",
  advisoriesLink: "meanbox-advisories-link",
};

/** @type {ReturnType<typeof parsePageContext>} */
let lastContext = null;

browser.runtime.onInstalled.addListener(() => {
  setupMenus();
});

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

  if (msg.type === "open-sidebar") {
    // Firefox-only helper; ignore failures on other browsers.
    if (browser.sidebarAction?.open) {
      return browser.sidebarAction.open().then(() => ({ ok: true }));
    }
    return Promise.resolve({ ok: false });
  }

  return undefined;
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const linkUrl = info.linkUrl || "";
  const pageUrl = info.pageUrl || tab?.url || "";
  const selection = (info.selectionText || "").trim();

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
  description: "Search Meanbox — github:…  yt:…  or free text",
});

browser.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const raw = text.trim();
  if (!raw) return;
  let path = `/github?q=${encodeURIComponent(raw.slice(0, 100))}`;
  const lower = raw.toLowerCase();
  if (lower.startsWith("yt:") || lower.startsWith("youtube:")) {
    const q = raw.replace(/^(yt|youtube):\s*/i, "").trim();
    path = `/youtube?q=${encodeURIComponent(q.slice(0, 200))}`;
  } else if (lower.startsWith("gh:") || lower.startsWith("github:")) {
    const q = raw.replace(/^(gh|github):\s*/i, "").trim();
    path = `/github?q=${encodeURIComponent(q.slice(0, 100))}`;
  } else if (parseYouTubeVideoUrl(raw) || /^[\w-]{11}$/.test(raw)) {
    const yt = parseYouTubeVideoUrl(raw);
    const id = yt?.videoId || raw;
    path = `/youtube?videoId=${encodeURIComponent(id)}`;
  } else if (parseGitHubRepoUrl(raw) || /^[\w.-]+\/[\w.-]+$/.test(raw)) {
    const gh = parseGitHubRepoUrl(raw);
    const repo = gh?.fullName || raw;
    path = `/github?repo=${encodeURIComponent(repo)}`;
  }

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
  });
}

/**
 * @param {browser.tabs.Tab | undefined} tab
 */
async function syncContextFromTab(tab) {
  if (!tab?.url) return;
  const context = parsePageContext(tab.url);
  lastContext = context;
  await browser.storage.session.set({ pageContext: context });
  await updateActionBadge(context);
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
