import {
  DEFAULT_API_BASE,
  DEFAULT_LOCALE,
  getSettings,
  normalizeApiBase,
  saveSettings,
} from "./lib/config.js";
import { setStatus } from "./lib/ui.js";

const apiBaseEl = document.getElementById("apiBase");
const localeEl = document.getElementById("locale");
const statusEl = document.getElementById("status");

const HOSTS = [
  "https://meanbox.vercel.app/*",
  "http://localhost:3000/*",
  "https://github.com/*",
  "https://*.github.com/*",
  "https://www.youtube.com/*",
  "https://youtube.com/*",
  "https://m.youtube.com/*",
];

async function load() {
  const settings = await getSettings();
  apiBaseEl.value = settings.apiBase || DEFAULT_API_BASE;
  localeEl.value = settings.locale || DEFAULT_LOCALE;
}

document.getElementById("save")?.addEventListener("click", async () => {
  try {
    const apiBase = normalizeApiBase(apiBaseEl.value) || DEFAULT_API_BASE;
    await saveSettings({
      apiBase,
      locale: localeEl.value || DEFAULT_LOCALE,
    });
    // Also request the configured API origin if custom
    const origin = `${new URL(apiBase).origin}/*`;
    if (!HOSTS.includes(origin)) {
      await browser.permissions.request({ origins: [origin] }).catch(() => false);
    }
    setStatus(statusEl, "Saved.", "ok");
  } catch (e) {
    setStatus(statusEl, e.message || String(e), "error");
  }
});

document.getElementById("grant")?.addEventListener("click", async () => {
  try {
    const settings = await getSettings();
    const origins = new Set(HOSTS);
    origins.add(`${new URL(settings.apiBase).origin}/*`);
    // Optional broad hosts — needed to extract articles on news / e-learning sites.
    origins.add("https://*/*");
    origins.add("http://*/*");
    const ok = await browser.permissions.request({
      origins: [...origins],
    });
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

load().catch((e) => setStatus(statusEl, e.message || String(e), "error"));
