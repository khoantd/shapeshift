/**
 * Caption language preference + acceptance (pure — safe for unit tests).
 * Prevents auto-translated tracks (e.g. Arabic) from winning when en/vi is preferred.
 */

export const DEFAULT_TRANSCRIPT_PREFER_LANGS = ["en", "vi", "en-US", "en-GB"] as const;

const ARABIC_LETTER_RE = /[\u0600-\u06FF]/g;
const LATIN_LETTER_RE = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/g;
const VIETNAMESE_LETTER_RE =
  /[\u0102\u0103\u00C2\u00E2\u00CA\u00EA\u00D4\u00F4\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]/g;

export type CaptionLangTrack = {
  languageCode: string;
  kind?: string;
};

export function normalizeLangCode(code: string): string {
  return code.trim().toLowerCase().replace(/_/g, "-");
}

/** True when `code` matches any preferred entry (prefix, e.g. en → en-US). */
export function languageMatchesPrefer(
  code: string | null | undefined,
  preferLangs: readonly string[],
): boolean {
  if (!code?.trim() || preferLangs.length === 0) return false;
  const normalized = normalizeLangCode(code);
  return preferLangs.some((pref) => {
    const p = normalizeLangCode(pref);
    return normalized === p || normalized.startsWith(`${p}-`) || p.startsWith(`${normalized}-`);
  });
}

/**
 * Pick a caption track in preferred-language order.
 * Within a language, prefer manual (non-ASR) over ASR.
 * When `allowAny` is false (default), never fall back to unrelated languages.
 */
export function pickPreferredCaptionTrack<T extends CaptionLangTrack>(
  tracks: T[],
  preferLangs: readonly string[],
  opts?: { allowAny?: boolean },
): T | null {
  if (tracks.length === 0) return null;

  for (const lang of preferLangs) {
    const hits = tracks.filter((t) => languageMatchesPrefer(t.languageCode, [lang]));
    if (hits.length === 0) continue;
    const manual = hits.find((t) => (t.kind ?? "").toLowerCase() !== "asr");
    return manual ?? hits[0] ?? null;
  }

  if (!opts?.allowAny) return null;

  const manual = tracks.find((t) => (t.kind ?? "").toLowerCase() !== "asr");
  return manual ?? tracks[0] ?? null;
}

function letterCounts(text: string): { arabic: number; latin: number; vietnamese: number } {
  const sample = text.slice(0, 8_000);
  return {
    arabic: (sample.match(ARABIC_LETTER_RE) ?? []).length,
    latin: (sample.match(LATIN_LETTER_RE) ?? []).length,
    vietnamese: (sample.match(VIETNAMESE_LETTER_RE) ?? []).length,
  };
}

/** Dominant Arabic script — typical YouTube auto-translate into ar. */
export function hasDominantArabicScript(text: string): boolean {
  const { arabic, latin, vietnamese } = letterCounts(text);
  const other = latin + vietnamese;
  if (arabic < 40) return false;
  return arabic > other * 1.5;
}

/**
 * Accept a fetched transcript only when language / script matches preference.
 * Missing language is OK if the text script is compatible with preferLangs.
 */
export function isAcceptableTranscriptLanguage(input: {
  language?: string | null;
  text: string;
  preferLangs: readonly string[];
}): boolean {
  const { language, text, preferLangs } = input;
  if (!text.trim()) return false;
  if (preferLangs.length === 0) return true;

  if (language?.trim() && !languageMatchesPrefer(language, preferLangs)) {
    return false;
  }

  const wantsLatinFamily = preferLangs.some((l) => {
    const n = normalizeLangCode(l);
    return n === "en" || n.startsWith("en-") || n === "vi" || n.startsWith("vi-");
  });

  if (wantsLatinFamily && hasDominantArabicScript(text)) {
    return false;
  }

  return true;
}
