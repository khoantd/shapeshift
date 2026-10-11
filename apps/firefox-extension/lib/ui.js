/** Small shared DOM helpers for popup / sidebar. */

/**
 * @param {HTMLElement | null} el
 * @param {string} text
 * @param {"idle" | "loading" | "error" | "ok"} [kind]
 */
export function setStatus(el, text, kind = "idle") {
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
  el.hidden = !text;
}

/**
 * Escape text for safe HTML insertion.
 * @param {string} s
 */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render markdown-ish text as plain preformatted block (no HTML injection).
 * @param {HTMLElement} el
 * @param {string} text
 */
export function setPlainText(el, text) {
  el.textContent = text || "";
}

/**
 * @param {number} n
 */
export function formatCount(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * ISO-8601 duration (YouTube) → compact clock, e.g. PT17M37S → 17:37
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function formatIsoDuration(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s;
  const m = s.match(
    /^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)$/i,
  );
  if (!m) return null;
  const hours = Number(m[1] || 0);
  const minutes = Number(m[2] || 0);
  const seconds = Math.floor(Number(m[3] || 0));
  if (!hours && !minutes && !seconds && !m[1] && !m[2] && !m[3]) return null;
  const pad = (n) => String(n).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

const DESC_NOISE =
  /skip to content|sign in|pull requests|changed files with|add-travis|confirm-internal-staff|\.github\/workflows|navigation menu|toggle.*menu/i;

/**
 * Clean repo/video blurb for compact list rows.
 * @param {string | null | undefined} text
 * @param {number} [maxLen]
 * @returns {string}
 */
export function cleanDescription(text, maxLen = 120) {
  if (typeof text !== "string") return "";
  let s = text.replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (DESC_NOISE.test(s)) return "";
  if (s.length > 400 && (s.includes("{") || s.includes("http") || /\d+\s+additions/i.test(s))) {
    return "";
  }
  if (s.length > maxLen) {
    s = s.slice(0, maxLen - 1).trimEnd() + "…";
  }
  return s;
}

/**
 * Join meta segments with middots, skipping empties.
 * @param {...(string | null | undefined)} parts
 */
export function joinMeta(...parts) {
  return parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(" · ");
}
