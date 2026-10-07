/**
 * Pure caption formatting helpers (no server-only) — safe for unit tests + client-free server use.
 */

import {
  DEFAULT_TRANSCRIPT_PREFER_LANGS,
  pickPreferredCaptionTrack,
} from "./captionLanguage";

export function formatCaptionTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) {
    return `${h}:${String(mm).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${mm}:${String(r).padStart(2, "0")}`;
}

/** Parse SRT timestamp `HH:MM:SS,mmm` or `HH:MM:SS.mmm` → seconds. */
export function parseSrtTimestamp(raw: string): number | null {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(m[3]);
  const ms = Number(m[4].padEnd(3, "0"));
  if (![h, min, sec, ms].every(Number.isFinite)) return null;
  return h * 3600 + min * 60 + sec + ms / 1000;
}

/**
 * Convert SubRip (SRT) caption text to `[mm:ss] line` transcript format.
 */
export function parseSrtToTranscript(srt: string): string {
  const normalized = srt.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const blocks = normalized.split(/\n{2,}/);
  const lines: string[] = [];

  for (const block of blocks) {
    const parts = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (parts.length < 2) continue;

    let idx = 0;
    // Optional cue number
    if (/^\d+$/.test(parts[0]!)) idx = 1;
    if (idx >= parts.length) continue;

    const timing = parts[idx]!;
    const arrow = timing.split(/\s*-->\s*/);
    if (arrow.length < 2) continue;
    const start = parseSrtTimestamp(arrow[0]!);
    const body = parts
      .slice(idx + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!body) continue;
    if (start != null && Number.isFinite(start)) {
      lines.push(`[${formatCaptionTimestamp(start)}] ${body}`);
    } else {
      lines.push(body);
    }
  }

  return lines.join("\n").trim();
}

export type ApiCaptionTrack = {
  id: string;
  language: string;
  trackKind?: string;
  name?: string;
};

/** Prefer preferred langs, then manual (non-ASR) tracks. */
export function pickApiCaptionTrack(
  tracks: ApiCaptionTrack[],
  preferLangs: string[] = [...DEFAULT_TRANSCRIPT_PREFER_LANGS],
): ApiCaptionTrack | null {
  const mapped = tracks.map((t) => ({
    languageCode: t.language,
    kind: t.trackKind,
    id: t.id,
  }));
  const picked = pickPreferredCaptionTrack(mapped, preferLangs, { allowAny: true });
  if (!picked) return null;
  return tracks.find((t) => t.id === picked.id) ?? null;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

/** YouTube srv3 / timedtext format 3: `<p t="ms" d="ms"><s>word</s></p>`. */
function parseSrv3TimedText(xml: string): string {
  const lines: string[] = [];
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = Number(match[1]);
    const inner = match[3] ?? "";
    const text = inner
      .replace(/<s[^>]*>([\s\S]*?)<\/s>/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || !Number.isFinite(startMs)) continue;
    lines.push(`[${formatCaptionTimestamp(startMs / 1000)}] ${text}`);
  }
  return lines.join("\n").trim();
}

function parseTimedTextXml(xml: string): string {
  if (/<p\s+t="\d+"/.test(xml)) {
    const srv3 = parseSrv3TimedText(xml);
    if (srv3) return srv3;
  }
  const lines: string[] = [];
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const attrs = match[1] ?? "";
    const body = stripTags(decodeXmlEntities(match[2] ?? "")).trim();
    if (!body) continue;
    const startMatch = /\bstart="([\d.]+)"/i.exec(attrs);
    const start = startMatch ? Number(startMatch[1]) : NaN;
    if (Number.isFinite(start)) {
      lines.push(`[${formatCaptionTimestamp(start)}] ${body}`);
    } else {
      lines.push(body);
    }
  }
  return lines.join("\n").trim();
}

function parseJson3Captions(raw: string): string {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return "";
  }
  if (!data || typeof data !== "object") return "";
  const events = (data as { events?: unknown }).events;
  if (!Array.isArray(events)) return "";

  const lines: string[] = [];
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const e = ev as { tStartMs?: unknown; segs?: unknown };
    const segs = e.segs;
    if (!Array.isArray(segs)) continue;
    const text = segs
      .map((seg) =>
        seg && typeof seg === "object" && typeof (seg as { utf8?: unknown }).utf8 === "string"
          ? (seg as { utf8: string }).utf8
          : "",
      )
      .join("")
      .replace(/\n/g, " ")
      .trim();
    if (!text) continue;
    const ms = typeof e.tStartMs === "number" ? e.tStartMs : NaN;
    if (Number.isFinite(ms)) {
      lines.push(`[${formatCaptionTimestamp(ms / 1000)}] ${text}`);
    } else {
      lines.push(text);
    }
  }
  return lines.join("\n").trim();
}

/** Parse json3, VTT, or classic timedtext XML caption payloads. */
export function parseCaptionBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("{")) return parseJson3Captions(trimmed);
  if (trimmed.includes("WEBVTT")) {
    const lines: string[] = [];
    const blocks = trimmed.split(/\n{2,}/);
    for (const block of blocks) {
      const parts = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (parts[0]?.startsWith("WEBVTT") || parts[0]?.startsWith("NOTE")) continue;
      const timeIdx = parts.findIndex((p) => p.includes("-->"));
      if (timeIdx < 0) continue;
      const startRaw = parts[timeIdx]!.split("-->")[0]?.trim() ?? "";
      const m = /(\d{2}):(\d{2}):(\d{2})/.exec(startRaw);
      const bodyText = parts
        .slice(timeIdx + 1)
        .join(" ")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (!bodyText) continue;
      if (m) {
        const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
        lines.push(`[${formatCaptionTimestamp(sec)}] ${bodyText}`);
      } else {
        lines.push(bodyText);
      }
    }
    return lines.join("\n").trim();
  }
  return parseTimedTextXml(trimmed);
}

/** Map youtube-transcript style segments ({ text, offset ms }) to timestamped lines. */
export function mapLibrarySegmentsToText(
  items: Array<{ text: string; offset: number }>,
): string {
  const lines: string[] = [];
  for (const item of items) {
    const body = (item.text ?? "").replace(/\n/g, " ").trim();
    if (!body) continue;
    const sec = Number(item.offset) / 1000;
    if (Number.isFinite(sec)) {
      lines.push(`[${formatCaptionTimestamp(sec)}] ${body}`);
    } else {
      lines.push(body);
    }
  }
  return lines.join("\n").trim();
}
