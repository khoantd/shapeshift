import {
  DEFAULT_API_BASE,
  DEFAULT_LOCALE,
  getSettings,
  normalizeApiBase,
  saveSettings,
} from "./lib/config.js";
import {
  clearLocalHistory,
  countPendingSync,
  readSyncMeta,
} from "./lib/localHistory.js";
import { setStatus } from "./lib/ui.js";

const apiBaseEl = document.getElementById("apiBase");
const localeEl = document.getElementById("locale");
const statusEl = document.getElementById("status");
const syncMetaEl = document.getElementById("syncMeta");

const HOSTS = [
  "https://meanbox.vercel.app/*",
  "http://localhost:3000/*",
  "https://github.com/*",
  "https://*.github.com/*",
  "https://www.youtube.com/*",
  "https://youtube.com/*",
  "https://m.youtube.com/*",
];

async function refreshLocalMeta() {
  if (!syncMetaEl) return;
  const { apiBase } = await getSettings();
  const [{ pending }, meta] = await Promise.all([
    countPendingSync(apiBase),
    readSyncMeta(),
  ]);
  const parts = [`${pending} item${pending === 1 ? "" : "s"} pending sync.`];
  if (meta.lastSyncMessage) parts.push(String(meta.lastSyncMessage));
  syncMetaEl.textContent = parts.join(" ");
  syncMetaEl.hidden = false;
}

async function load() {
  const settings = await getSettings();
  apiBaseEl.value = settings.apiBase || DEFAULT_API_BASE;
  localeEl.value = settings.locale || DEFAULT_LOCALE;
  await refreshLocalMeta();
}

document.getElementById("save")?.addEventListener("click", async () => {
  try {
    const apiBase = normalizeApiBase(apiBaseEl.value) || DEFAULT_API_BASE;
    // Must invoke permissions.request in the same turn as the click (before any await).
    const origin = `${new URL(apiBase).origin}/*`;
    const hostPermPromise = HOSTS.includes(origin)
      ? Promise.resolve(true)
      : browser.permissions.request({ origins: [origin] }).catch(() => false);
    await saveSettings({
      apiBase,
      locale: localeEl.value || DEFAULT_LOCALE,
    });
    await hostPermPromise;
    setStatus(statusEl, "Saved.", "ok");
  } catch (e) {
    setStatus(statusEl, e.message || String(e), "error");
  }
});

document.getElementById("grant")?.addEventListener("click", async () => {
  try {
    const apiBase = normalizeApiBase(apiBaseEl.value) || DEFAULT_API_BASE;
    const origins = new Set(HOSTS);
    origins.add(`${new URL(apiBase).origin}/*`);
    // Optional broad hosts — needed to extract articles on news / e-learning sites.
    origins.add("https://*/*");
    origins.add("http://*/*");
    const permPromise = browser.permissions.request({
      origins: [...origins],
    });
    const ok = await permPromise;
    setStatus(
      statusEl,
      ok
        ? "Host access granted (including open-web pages for deep dive)."
        : "Host access not fully granted.",
      ok ? "ok" : "error",
    );
  } catch (e) {
    setStatus(statusEl, e.message || String(e), "error");
  }
});

document.getElementById("syncLocal")?.addEventListener("click", async () => {
  try {
    setStatus(statusEl, "Syncing…", "loading");
    const result = await browser.runtime.sendMessage({
      type: "sync-local-history",
    });
    await refreshLocalMeta();
    setStatus(statusEl, result?.message || "Sync finished.", "ok");
  } catch (e) {
    setStatus(statusEl, e.message || String(e), "error");
  }
});

document.getElementById("clearLocal")?.addEventListener("click", async () => {
  try {
    await clearLocalHistory();
    await refreshLocalMeta();
    setStatus(statusEl, "Device history cleared.", "ok");
  } catch (e) {
    setStatus(statusEl, e.message || String(e), "error");
  }
});

load().catch((e) => setStatus(statusEl, e.message || String(e), "error"));
