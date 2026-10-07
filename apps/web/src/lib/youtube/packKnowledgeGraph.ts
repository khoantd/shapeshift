import type { GraphLink, GraphNode, GraphPayload } from "@/lib/neo4j/types";
import { extractKeyConcepts } from "@/lib/youtube/learningPackConcepts";

export type PackKnowledgeInput = {
  videoId: string;
  title: string;
  channelTitle?: string;
  contentType?: string;
  markdown: string;
};

function slugify(raw: string): string {
  return (
    raw
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "item"
  );
}

/** Ensure stable unique ids when titles/timestamps collide after slugify. */
function allocateId(used: Set<string>, base: string): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}:${n}`)) n += 1;
  const id = `${base}:${n}`;
  used.add(id);
  return id;
}

/** Collapse duplicate node ids and duplicate (source,target,type) links. */
export function dedupeGraphPayload(graph: GraphPayload): GraphPayload {
  const nodesById = new Map<string, GraphNode>();
  for (const node of graph.nodes) {
    if (!nodesById.has(node.id)) nodesById.set(node.id, node);
  }
  const nodeIds = new Set(nodesById.keys());
  const linksByTriple = new Map<string, GraphLink>();
  for (const link of graph.links) {
    if (!nodeIds.has(link.source) || !nodeIds.has(link.target)) continue;
    if (link.source === link.target) continue;
    const triple = `${link.source}\0${link.target}\0${link.type}`;
    if (linksByTriple.has(triple)) continue;
    linksByTriple.set(triple, { ...link, id: link.id || triple });
  }
  return { nodes: [...nodesById.values()], links: [...linksByTriple.values()] };
}

function plainHeadingText(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/\*+/g, "")
    .trim();
}

function isHeading(line: string, pattern: RegExp): boolean {
  if (!/^#{1,3}\s+/.test(line)) return false;
  return pattern.test(plainHeadingText(line).toLowerCase());
}

function isSectionBreak(line: string): boolean {
  return /^#{1,2}\s+/.test(line.trim()) && !/^###/.test(line.trim());
}

function spansToText(line: string): string {
  return line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").trim();
}

/** Pack chrome / instructional bold labels — never knowledge-graph terms. */
const META_BOLD =
  /^(in plain words|why it matters|revisit|timestamp|plain words|creator|duration|language|content type|study depth|audience|claim|conclusion|reasoning|illustrations?|key arguments?|tl;?dr|who this(?: is for)?|what you.?ll be able|explain|recall|apply|analyze|analyse|reflect|evaluate|create|understand|remember|check your|answer key|flashcards?|self[- ]?test|worked example|go deeper|apply it|key concepts?|insights?|takeaways?|glossary|structured notes)$/i;

/** Strip trailing label colons (ASCII / fullwidth) from pack chrome like `Claim:`. */
function stripTrailingLabelColon(raw: string): string {
  return raw.replace(/[:：]+\s*$/u, "").trim();
}

const STOP_WORDS = new Set(
  [
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "if",
    "then",
    "so",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "from",
    "by",
    "as",
    "at",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "it",
    "its",
    "this",
    "that",
    "these",
    "those",
    "not",
    "no",
    "yes",
    "you",
    "your",
    "we",
    "our",
    "they",
    "their",
    "can",
    "could",
    "should",
    "would",
    "will",
    "just",
    "also",
    "than",
    "into",
    "over",
    "under",
    "about",
    "via",
    "per",
    "vs",
    "etc",
    "và",
    "của",
    "là",
    "một",
    "các",
    "những",
    "cho",
    "với",
    "không",
    "được",
    "khi",
    "này",
    "đó",
  ].map((w) => w.toLowerCase()),
);

/**
 * Common English verbs / verb forms that should not head a knowledge-graph term.
 * Gerunds kept only when part of a multi-word noun phrase (e.g. "Architectural thinking").
 */
const VERB_WORDS = new Set(
  [
    "make",
    "makes",
    "made",
    "making",
    "let",
    "lets",
    "letting",
    "jump",
    "jumps",
    "jumped",
    "jumping",
    "build",
    "builds",
    "built",
    "building",
    "create",
    "creates",
    "created",
    "creating",
    "decide",
    "decides",
    "decided",
    "deciding",
    "see",
    "sees",
    "saw",
    "seeing",
    "show",
    "shows",
    "showed",
    "showing",
    "use",
    "uses",
    "used",
    "using",
    "get",
    "gets",
    "got",
    "getting",
    "give",
    "gives",
    "gave",
    "giving",
    "take",
    "takes",
    "took",
    "taking",
    "keep",
    "keeps",
    "kept",
    "keeping",
    "start",
    "starts",
    "started",
    "starting",
    "stop",
    "stops",
    "stopped",
    "stopping",
    "learn",
    "learns",
    "learned",
    "learning",
    "teach",
    "teaches",
    "taught",
    "teaching",
    "help",
    "helps",
    "helped",
    "helping",
    "allow",
    "allows",
    "allowed",
    "allowing",
    "enable",
    "enables",
    "enabled",
    "enabling",
    "provide",
    "provides",
    "provided",
    "providing",
    "involve",
    "involves",
    "involved",
    "involving",
    "refer",
    "refers",
    "referred",
    "referring",
    "mean",
    "means",
    "meant",
    "meaning",
    "become",
    "becomes",
    "became",
    "becoming",
    "go",
    "goes",
    "went",
    "going",
    "come",
    "comes",
    "came",
    "coming",
    "run",
    "runs",
    "ran",
    "running",
    "move",
    "moves",
    "moved",
    "moving",
    "add",
    "adds",
    "added",
    "adding",
    "remove",
    "removes",
    "removed",
    "removing",
    "avoid",
    "avoids",
    "avoided",
    "avoiding",
    "choose",
    "chooses",
    "chose",
    "choosing",
    "need",
    "needs",
    "needed",
    "needing",
    "want",
    "wants",
    "wanted",
    "wanting",
    "try",
    "tries",
    "tried",
    "trying",
    "ask",
    "asks",
    "asked",
    "asking",
    "say",
    "says",
    "said",
    "saying",
    "tell",
    "tells",
    "told",
    "telling",
    "know",
    "knows",
    "knew",
    "knowing",
    "think",
    "thinks",
    "thought",
    "find",
    "finds",
    "found",
    "finding",
    "look",
    "looks",
    "looked",
    "looking",
    "work",
    "works",
    "worked",
    "working",
    "design",
    "designs",
    "designed",
    "designing",
    "scale",
    "scales",
    "scaled",
    "scaling",
    "settle",
    "settles",
    "settled",
    "settling",
    // Vietnamese verb-ish heads (light)
    "làm",
    "xây",
    "tạo",
    "học",
    "dạy",
    "giúp",
    "cho",
    "để",
    "cần",
    "nên",
    "phải",
  ].map((w) => w.toLowerCase()),
);

/** Noun-acceptable -ing / dual noun-verb tokens (esp. at phrase end). */
const GERUND_NOUN_OK = new Set(
  [
    "thinking",
    "learning",
    "teaching",
    "building",
    "designing",
    "scaling",
    "meaning",
    "design",
    "work",
    "scale",
    "tradeoff",
    "tradeoffs",
    "layout",
    "identity",
    "model",
    "models",
    "process",
    "processes",
    "system",
    "systems",
    "graph",
    "graphs",
    "node",
    "nodes",
  ].map((w) => w.toLowerCase()),
);

function tokenLemma(raw: string): string {
  return raw.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}

function isVerbToken(word: string): boolean {
  const w = tokenLemma(word);
  if (!w) return false;
  return VERB_WORDS.has(w);
}

/**
 * True when the phrase is verb-led or verb-heavy (action sentence fragment).
 * Allows multi-word noun phrases ending in a gerund/dual noun (Architectural thinking).
 */
export function isVerbPhrase(term: string): boolean {
  const words = term.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const first = tokenLemma(words[0]!);

  // Single verb / "Make" alone — reject unless dual noun-capable word used as noun alone
  if (words.length === 1) {
    if (GERUND_NOUN_OK.has(first)) return false;
    return isVerbToken(words[0]!);
  }

  // Verb-led imperative / VP: "Make tradeoffs", "Build systems", "Let learners"
  if (isVerbToken(words[0]!) && !GERUND_NOUN_OK.has(first)) {
    return true;
  }

  // Reject verbs in non-final position ("graphs make relationships")
  for (let i = 0; i < words.length - 1; i++) {
    const w = tokenLemma(words[i]!);
    if (!isVerbToken(words[i]!)) continue;
    // Allow dual noun at non-final only if not a clear finite verb form
    if (GERUND_NOUN_OK.has(w) && !/s$|ed$|ing$/.test(w)) continue;
    if (GERUND_NOUN_OK.has(w) && (w.endsWith("ing") || w === "design" || w === "work")) {
      // "Learning path", "Design system" — OK as modifier
      continue;
    }
    return true;
  }

  // Final token: reject clear finite verbs, keep noun-capable duals
  const last = tokenLemma(words[words.length - 1]!);
  if (isVerbToken(words[words.length - 1]!) && !GERUND_NOUN_OK.has(last)) {
    return true;
  }

  return false;
}

/**
 * Collapse a concept headline / clause into a short noun-ish key term.
 * e.g. "Architectural thinking is a perspective, not a title" → "Architectural thinking"
 */
export function toNounPhrase(raw: string): string {
  let t = stripTrailingLabelColon(raw.replace(/\*+/g, "").trim());
  if (!t) return "";

  // Comma / và lists must not collapse into one truncated phrase ("MB Bank, ACB")
  const listItems = splitEntityListItems(t);
  if (listItems.length > 1) {
    t = listItems[0]!;
  }

  // Prefer content before elaborating punctuation / dash
  t = t.split(/\s+[—–]\s+|:\s+/)[0]!.trim();
  t = stripTrailingLabelColon(t);

  // Cut at common predicate / relative clause starts
  t = t
    .split(
      /\s+(?:is|are|was|were|means|means that|refers to|involves|lets|let|makes|make|helps|help|allows|allow|provides|provide|enables|enable)\s+/i,
    )[0]!
    .trim();

  // Drop trailing ", not …" / ", which …"
  t = t.replace(/,\s*(?:not|which|that|where|when|while)\b.*$/i, "").trim();
  t = t.replace(/[.?!;:：]+$/gu, "").trim();

  // Strip leading imperative / verb head: "Make tradeoffs early" → "tradeoffs early"
  const lead = t.split(/\s+/);
  if (lead.length >= 2 && isVerbToken(lead[0]!) && !GERUND_NOUN_OK.has(tokenLemma(lead[0]!))) {
    t = lead.slice(1).join(" ").trim();
    // Drop dangling adverbs after strip: "tradeoffs early" OK; "systems that scale" cut at that
    t = t.split(/\s+(?:that|which|who|where)\s+/i)[0]!.trim();
  }

  // Soft length cap — keep title-like continuations (VN: Ngân hàng Nhà nước…)
  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length > 6 || t.length > 56) {
    const kept: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (isVerbToken(tok) && kept.length > 0) break;
      kept.push(tok);
      const content = kept.filter(
        (w) => !STOP_WORDS.has(tokenLemma(w)) && !isVerbToken(w),
      );
      const next = tokens[i + 1];
      const nextContinuesTitle =
        Boolean(next) &&
        (/^\p{Lu}/u.test(next!) || /^[\p{Ll}][\p{L}\p{N}]{1,16}$/u.test(next!));
      if (
        (content.length >= 3 || kept.join(" ").length >= 40) &&
        !(nextContinuesTitle && kept.length < 7)
      ) {
        break;
      }
    }
    t = kept.join(" ").replace(/[,;:]+$/g, "").trim();
  }

  return t.slice(0, 64);
}

function normalizeTermKey(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Short proper-noun-ish segment safe to keep as a graph entity. */
function looksLikeEntityItem(part: string): boolean {
  const t = part.trim();
  if (!t || t.length > 48) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;
  if (/^(not|which|that|where|when|while|and|or|và)\b/i.test(t)) return false;
  if (!words.every((w) => /^[\p{L}\p{N}]/u.test(w))) return false;
  // Prefer capitalized / acronym heads (MB Bank, ACB, Vietcombank, PVcombank)
  return words.some((w) => /^[A-Z\p{Lu}]/u.test(w));
}

/**
 * Split comma / semicolon / và|and|or lists into separate entity candidates.
 * Returns the original string alone when the split does not look like an entity list.
 */
export function splitEntityListItems(raw: string): string[] {
  const t = raw.replace(/\*+/g, "").trim();
  if (!t) return [];
  const normalized = t
    .replace(/\s+(?:và|and|or)\s+/gi, ", ")
    .replace(/;/g, ",");
  if (!/,/.test(normalized)) return [t];
  const parts = normalized
    .split(/\s*,\s*/)
    .map((p) => p.replace(/[.?!]+$/g, "").trim())
    .filter(Boolean);
  if (parts.length < 2) return [t];
  if (!parts.every(looksLikeEntityItem)) return [t];
  return parts;
}

/** Capitalized token (Unicode; not ASCII-only [A-Z]). */
const CAP_WORD = String.raw`[\p{Lu}][\p{L}\p{N}]*`;

/**
 * Known lowercase title/org particles (not open-ended — avoids verbs like "gặp").
 * Matched case-insensitively.
 */
const TITLE_PARTICLE_RE = String.raw`(?:tướng|chính|hàng|nước|học|viện|thống|đốc|trưởng|tổng|lý|sư|quán|ban|sở|cục|ủy|of|the|and|for)`;

const TITLE_TOKEN = String.raw`(?:${CAP_WORD}|${TITLE_PARTICLE_RE})`;

/** Strict CapWords for comma-lists (MB Bank, ACB) — no lowercase glue. */
const CAP_CHUNK_STRICT = String.raw`${CAP_WORD}(?:\s+${CAP_WORD}){0,4}`;

/** Comma-separated CapWord list, optional trailing và/and/or item. */
const ENTITY_LIST_RE = new RegExp(
  String.raw`(?<![\p{L}\p{N}])((?:${CAP_CHUNK_STRICT})(?:\s*[,;]\s*${CAP_CHUNK_STRICT})+(?:\s+(?:và|and|or)\s+${CAP_CHUNK_STRICT})?)(?![\p{L}\p{N}])`,
  "gu",
);

/**
 * Multi-word title / proper-noun phrase with Unicode boundaries.
 * Avoids ASCII \\b which splits Vietnamese syllables (Thủ → Th).
 */
const TITLE_PHRASE_RE = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(${CAP_WORD}(?:\s+${TITLE_TOKEN}){1,6})(?![\p{L}\p{N}])`,
  "gui",
);

/** Role particles after which a CapWord run is usually a person name. */
const ROLE_PARTICLES = new Set([
  "tướng",
  "đốc",
  "trưởng",
  "lý",
  "sư",
  "quán",
  "thống",
]);

function countCapWords(phrase: string): number {
  return phrase.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w)).length;
}

/** Reject English fragments like "Interest rates rose" (one capital). */
function hasEnoughCapWords(phrase: string): boolean {
  return countCapWords(phrase) >= 2;
}

/**
 * "Phó Thủ tướng Trần Hồng Hà" → ["Phó Thủ tướng", "Trần Hồng Hà"]
 * Leaves org titles like "Ngân hàng Nhà nước Việt Nam" intact.
 */
function splitRoleTitleAndName(phrase: string): string[] {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length < 4) return [phrase];
  let roleIdx = -1;
  for (let i = 0; i < words.length; i++) {
    if (ROLE_PARTICLES.has(words[i]!.toLowerCase())) roleIdx = i;
  }
  if (roleIdx < 0 || roleIdx >= words.length - 2) return [phrase];
  const after = words.slice(roleIdx + 1);
  if (after.length < 2 || after.length > 4) return [phrase];
  if (!after.every((w) => /^\p{Lu}/u.test(w))) return [phrase];
  return [words.slice(0, roleIdx + 1).join(" "), after.join(" ")];
}

/** True for short bold spans that are pack labels (`Claim:`, `Study depth:`). */
function isColonTerminatedLabel(raw: string): boolean {
  const trimmed = raw.trim();
  if (!/[:：]\s*$/u.test(trimmed)) return false;
  const words = stripTrailingLabelColon(trimmed).split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 3;
}

function isGoodTerm(term: string): boolean {
  const t = stripTrailingLabelColon(term.trim());
  if (t.length < 2 || t.length > 64) return false;
  if (META_BOLD.test(t)) return false;
  if (/^\[\d/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 7) return false;
  if (words.length === 1 && STOP_WORDS.has(tokenLemma(t))) return false;
  if (isVerbPhrase(t)) return false;
  const stopRatio =
    words.filter((w) => STOP_WORDS.has(tokenLemma(w))).length / words.length;
  if (words.length >= 3 && stopRatio > 0.4) return false;
  return true;
}

/** Collect **bold** noun candidates from markdown (skip meta labels). */
export function extractBoldTerms(markdown: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /\*\*(.+?)\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    if (isColonTerminatedLabel(m[1]!)) continue;
    for (const item of splitEntityListItems(m[1]!)) {
      if (isColonTerminatedLabel(item)) continue;
      const phrase = toNounPhrase(item);
      if (!isGoodTerm(phrase)) continue;
      const key = normalizeTermKey(phrase);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(phrase);
    }
  }
  return out;
}

/**
 * Pull noun-ish key phrases from free text (insights, concept bodies).
 * Prefers bold / quoted / Title Case multi-word phrases — never whole sentences.
 */
export function extractNounKeyPhrases(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    if (isColonTerminatedLabel(raw)) return;
    for (const item of splitEntityListItems(raw)) {
      if (isColonTerminatedLabel(item)) continue;
      const phrase = toNounPhrase(item);
      if (!isGoodTerm(phrase)) continue;
      const key = normalizeTermKey(phrase);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(phrase);
    }
  };

  for (const m of text.matchAll(/\*\*(.+?)\*\*/g)) push(m[1]!);
  for (const m of text.matchAll(/"([^"]{2,60})"|'([^']{2,60})'/g)) {
    push(m[1] || m[2] || "");
  }
  // Comma / và lists of proper nouns (MB Bank, ACB, Vietcombank và Publicbank)
  for (const m of text.matchAll(ENTITY_LIST_RE)) {
    push(m[1]!);
  }
  // Title / proper-noun phrases (Unicode-safe; allows VN title particles)
  for (const m of text.matchAll(TITLE_PHRASE_RE)) {
    const raw = m[1]!;
    if (!hasEnoughCapWords(raw)) continue;
    for (const part of splitRoleTitleAndName(raw)) {
      if (!hasEnoughCapWords(part)) continue;
      push(part);
    }
  }

  // No whole-line fallback — bare insight sentences must not become nodes.
  return out;
}

export type GlossaryEntry = { term: string; definition: string };
export type InsightEntry = { text: string };

/** Extract glossary term / definition pairs under a Glossary heading. */
export function extractGlossary(markdown: string): GlossaryEntry[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inSection = false;
  const out: GlossaryEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,3}\s+/.test(trimmed) && !/^####/.test(trimmed)) {
      const level = (trimmed.match(/^#+/) ?? ["##"])[0]!.length;
      if (
        isHeading(
          trimmed,
          /^(glossary|thuật\s*ngữ|definitions?|key\s*terms?)$|glossary|thuật\s*ngữ/,
        )
      ) {
        inSection = true;
        continue;
      }
      if (level <= 2 && inSection) {
        inSection = false;
        continue;
      }
    }
    if (!inSection) continue;
    if (!trimmed || isSectionBreak(trimmed)) continue;

    const bold =
      /^\s*[-*]?\s*\*\*(.+?)\*\*\s*[:—–-]\s*(.+)$/.exec(trimmed) ??
      /^\s*[-*]?\s*\*\*(.+?)\*\*\s*$/.exec(trimmed);
    if (bold) {
      const term = toNounPhrase(bold[1]!);
      const definition = (bold[2] ?? "").trim();
      if (isGoodTerm(term)) {
        out.push({ term, definition: definition || term });
      }
      continue;
    }
    const plain = /^\s*[-*]\s+([^:—–-]{1,80})\s*[:—–]\s*(.+)$/.exec(trimmed);
    if (plain) {
      const term = toNounPhrase(plain[1]!);
      if (isGoodTerm(term)) out.push({ term, definition: plain[2]!.trim() });
    }
  }
  return out;
}

/** Extract insight / takeaway bullets under Insights / Takeaways headings. */
export function extractInsights(markdown: string): InsightEntry[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inSection = false;
  const out: InsightEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,3}\s+/.test(trimmed) && !/^####/.test(trimmed)) {
      const level = (trimmed.match(/^#+/) ?? ["##"])[0]!.length;
      if (
        isHeading(
          trimmed,
          /insight|takeaway|bài\s*học|điểm\s*chính|so\s*what/,
        )
      ) {
        inSection = true;
        continue;
      }
      if (level <= 2 && inSection) {
        inSection = false;
        continue;
      }
    }
    if (!inSection) continue;
    const bullet = /^\s*(?:[-*]|\d+[.)])\s+(.+)$/.exec(trimmed);
    if (!bullet) continue;
    const text = spansToText(bullet[1]!).slice(0, 400);
    if (text.length >= 8) out.push({ text });
  }
  return out.slice(0, 20);
}

type TermRec = {
  id: string;
  term: string;
  definition: string;
  sources: Set<string>;
};

/**
 * Build a GraphPayload centered on noun key terms (not sentence nodes).
 * Timed concepts are YtConcept only; glossary/bold nouns are YtGlossaryTerm.
 * One USES_TERM edge max between a concept and a distinct glossary term.
 */
export function packToKnowledgeGraph(input: PackKnowledgeInput): GraphPayload {
  const videoId = input.videoId.trim();
  const videoNodeId = `video:${videoId}`;
  const nodes: GraphNode[] = [
    {
      id: videoNodeId,
      label: input.title,
      labels: ["YtVideo"],
      properties: {
        id: videoId,
        name: input.title,
        title: input.title,
        channelTitle: input.channelTitle ?? "",
        contentType: input.contentType ?? "",
      },
    },
  ];
  const links: GraphLink[] = [];
  const usedIds = new Set<string>([videoNodeId]);

  const termsByKey = new Map<string, TermRec>();

  const upsertTerm = (
    rawTerm: string,
    opts?: { definition?: string; source?: string },
  ): TermRec | null => {
    const term = toNounPhrase(rawTerm);
    if (!isGoodTerm(term)) return null;
    const key = normalizeTermKey(term);
    const existing = termsByKey.get(key);
    if (existing) {
      if (opts?.definition && opts.definition.length > existing.definition.length) {
        existing.definition = opts.definition;
      }
      if (opts?.source) existing.sources.add(opts.source);
      return existing;
    }
    const id = allocateId(usedIds, `term:${videoId}:${slugify(term)}`);
    const rec: TermRec = {
      id,
      term,
      definition: opts?.definition ?? "",
      sources: new Set(opts?.source ? [opts.source] : []),
    };
    termsByKey.set(key, rec);
    return rec;
  };

  const linkOnce = (
    id: string,
    source: string,
    target: string,
    type: string,
    properties: Record<string, unknown> = {},
  ) => {
    if (source === target) return;
    if (
      links.some(
        (l) =>
          l.id === id ||
          (l.source === source && l.target === target && l.type === type),
      )
    ) {
      return;
    }
    links.push({ id, source, target, type, properties });
  };

  // 1) Glossary terms (authoritative definitions)
  for (const g of extractGlossary(input.markdown)) {
    upsertTerm(g.term, { definition: g.definition, source: "glossary" });
  }

  // 2) Bold terms pack-wide (meta/quiz chrome rejected by isGoodTerm)
  for (const t of extractBoldTerms(input.markdown)) {
    upsertTerm(t, { source: "bold" });
  }

  // 3) Timed key concepts → YtConcept only (do NOT clone as glossary terms)
  const concepts = extractKeyConcepts(input.markdown);
  const conceptEntries: { id: string; nounKey: string; title: string; fullTitle: string }[] =
    [];

  for (const c of concepts) {
    const noun = toNounPhrase(c.title);
    if (!isGoodTerm(noun)) continue;

    const conceptId = allocateId(
      usedIds,
      `concept:${videoId}:${slugify(noun)}:${c.startSec}`,
    );
    conceptEntries.push({
      id: conceptId,
      nounKey: normalizeTermKey(noun),
      title: noun,
      fullTitle: c.title,
    });
    nodes.push({
      id: conceptId,
      label: noun,
      labels: ["YtConcept"],
      properties: {
        id: conceptId,
        name: noun,
        title: noun,
        fullTitle: c.title,
        startSec: c.startSec,
        timestampLabel: c.timestampLabel,
        videoId,
      },
    });
    linkOnce(`rel:has-concept:${conceptId}`, videoNodeId, conceptId, "HAS_CONCEPT");
  }

  // Drop bold/insight term clones that only mirror a concept noun (keep glossary)
  for (const entry of conceptEntries) {
    const rec = termsByKey.get(entry.nounKey);
    if (rec && !rec.sources.has("glossary")) {
      termsByKey.delete(entry.nounKey);
    }
  }

  // 4) Insights → harvest noun phrases as terms; co-occurrence RELATED_TO
  for (const ins of extractInsights(input.markdown)) {
    const phrases = extractNounKeyPhrases(ins.text);
    const recs: TermRec[] = [];
    for (const p of phrases) {
      const rec = upsertTerm(p, { source: "insight" });
      if (rec) recs.push(rec);
    }
    for (const rec of termsByKey.values()) {
      const escaped = rec.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`,
        "iu",
      );
      if (re.test(ins.text) && !recs.some((r) => r.id === rec.id)) {
        recs.push(rec);
      }
    }
    for (let i = 0; i < recs.length; i++) {
      for (let j = i + 1; j < recs.length; j++) {
        const a = recs[i]!;
        const b = recs[j]!;
        linkOnce(
          `rel:related:${a.id}:${b.id}`,
          a.id,
          b.id,
          "RELATED_TO",
          { reason: "cooccur" },
        );
      }
    }
  }

  // 5) Emit term nodes + HAS_TERM from video
  for (const rec of termsByKey.values()) {
    nodes.push({
      id: rec.id,
      label: rec.term,
      labels: ["YtGlossaryTerm"],
      properties: {
        id: rec.id,
        name: rec.term,
        term: rec.term,
        definition: rec.definition,
        sources: [...rec.sources].join(","),
        videoId,
      },
    });
    linkOnce(`rel:has-term:${rec.id}`, videoNodeId, rec.id, "HAS_TERM");
  }

  // 6) Concept → USES_TERM only for *distinct* glossary terms (not self-clone)
  for (const entry of conceptEntries) {
    const hay = `${entry.title} ${entry.fullTitle}`;
    for (const rec of termsByKey.values()) {
      if (normalizeTermKey(rec.term) === entry.nounKey) continue;
      const escaped = rec.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`,
        "iu",
      );
      if (!re.test(hay)) continue;
      linkOnce(
        `rel:uses:${entry.id}:${rec.id}`,
        entry.id,
        rec.id,
        "USES_TERM",
      );
    }
  }

  // 7) RELATED_TO between concepts that share a glossary term
  for (let i = 0; i < conceptEntries.length; i++) {
    for (let j = i + 1; j < conceptEntries.length; j++) {
      const a = conceptEntries[i]!;
      const b = conceptEntries[j]!;
      const aTerms = links
        .filter((l) => l.source === a.id && l.type === "USES_TERM")
        .map((l) => l.target);
      const bTerms = new Set(
        links
          .filter((l) => l.source === b.id && l.type === "USES_TERM")
          .map((l) => l.target),
      );
      if (aTerms.some((t) => bTerms.has(t))) {
        linkOnce(`rel:related:${a.id}:${b.id}`, a.id, b.id, "RELATED_TO", {
          reason: "shared-term",
        });
      }
    }
  }

  return dedupeGraphPayload({ nodes, links });
}
