import type { GraphLink, GraphNode, GraphPayload } from "@/lib/neo4j/types";
import {
  dedupeGraphPayload,
  extractBoldTerms,
  extractNounKeyPhrases,
  toNounPhrase,
} from "@/lib/youtube/packKnowledgeGraph";

export type NewsKnowledgeSource = {
  title: string;
  url: string;
};

export type NewsKnowledgeInput = {
  storyId: string;
  title: string;
  canonicalUrl: string;
  deepDiveText: string;
  sources: NewsKnowledgeSource[];
  briefLine?: string;
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

/** Stable merge key for entities/concepts across articles. */
export function canonicalKeyFromName(name: string): string {
  return slugify(toNounPhrase(name) || name);
}

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

function pushNode(nodes: GraphNode[], used: Set<string>, node: GraphNode): string {
  const id = allocateId(used, node.id);
  nodes.push({ ...node, id, properties: { ...node.properties, id } });
  return id;
}

/**
 * Build a GraphPayload for a news story from deep-dive markdown (+ optional brief).
 * Labels: NewsArticle / NewsConcept / NewsEntity / NewsSource.
 */
export function newsToKnowledgeGraph(input: NewsKnowledgeInput): GraphPayload {
  const storyId = input.storyId.trim() || "unknown";
  const articleId = `news:article:${storyId}`;
  const used = new Set<string>();
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  pushNode(nodes, used, {
    id: articleId,
    label: input.title.trim().slice(0, 80) || "Article",
    labels: ["NewsArticle"],
    properties: {
      id: articleId,
      storyId,
      title: input.title.trim().slice(0, 500) || "Untitled",
      url: input.canonicalUrl.trim().slice(0, 2000),
      canonicalKey: `article:${storyId}`,
      name: input.title.trim().slice(0, 80) || "Article",
    },
  });

  const conceptNames: string[] = [];
  const entityNames: string[] = [];

  const brief = input.briefLine?.trim();
  if (brief && brief.length >= 8) {
    const phrase = toNounPhrase(brief) || brief.slice(0, 64);
    if (phrase.length >= 2) conceptNames.push(phrase);
    for (const t of extractBoldTerms(brief)) entityNames.push(t);
  }

  const text = input.deepDiveText.replace(/\r\n/g, "\n").trim();
  if (text) {
    // Bold phrases and noun key phrases become entities (cross-article merge keys).
    for (const t of extractBoldTerms(text)) {
      entityNames.push(t);
    }
    for (const para of text.split(/\n{2,}/)) {
      const plain = para.replace(/^#{1,6}\s+/gm, "").trim();
      if (plain.length < 12) continue;
      for (const p of extractNounKeyPhrases(plain)) {
        entityNames.push(p);
      }
    }
    // Section headings (## Key points) seed concepts when no brief.
    if (conceptNames.length === 0) {
      for (const line of text.split("\n")) {
        const h = /^#{2,3}\s+(.+)$/.exec(line.trim());
        if (!h) continue;
        const phrase = toNounPhrase(h[1]!) || h[1]!.trim();
        if (phrase.length >= 2 && phrase.length <= 64) conceptNames.push(phrase);
      }
    }
    // Fallback concept from story title so the article always has a concept hub.
    if (conceptNames.length === 0) {
      const fromTitle = toNounPhrase(input.title) || input.title.trim().slice(0, 64);
      if (fromTitle.length >= 2) conceptNames.push(fromTitle);
    }
  }

  const seenConcept = new Set<string>();
  for (const raw of conceptNames) {
    const name = toNounPhrase(raw) || raw.trim();
    const key = canonicalKeyFromName(name);
    if (!key || seenConcept.has(key)) continue;
    seenConcept.add(key);
    const id = pushNode(nodes, used, {
      id: `news:concept:${key}`,
      label: name.slice(0, 64),
      labels: ["NewsConcept"],
      properties: {
        id: `news:concept:${key}`,
        name: name.slice(0, 120),
        title: name.slice(0, 120),
        canonicalKey: key,
        storyId,
      },
    });
    links.push({
      id: `has-concept:${storyId}:${key}`,
      source: articleId,
      target: id,
      type: "HAS_CONCEPT",
      properties: {},
    });
  }

  const seenEntity = new Set<string>();
  for (const raw of entityNames) {
    const name = toNounPhrase(raw) || raw.trim();
    const key = canonicalKeyFromName(name);
    if (!key || seenEntity.has(key)) continue;
    // Allow same phrase as both concept and entity only once — prefer entity
    // for merge; skip if concept already owns this exact key with no separate need.
    if (seenConcept.has(key)) continue;
    seenEntity.add(key);
    const id = pushNode(nodes, used, {
      id: `news:entity:${key}`,
      label: name.slice(0, 64),
      labels: ["NewsEntity"],
      properties: {
        id: `news:entity:${key}`,
        name: name.slice(0, 120),
        term: name.slice(0, 120),
        canonicalKey: key,
        storyId,
      },
    });
    links.push({
      id: `mentions:${storyId}:${key}`,
      source: articleId,
      target: id,
      type: "MENTIONS",
      properties: {},
    });
  }

  const seenSource = new Set<string>();
  for (const src of input.sources) {
    const url = src.url.trim();
    if (!url || seenSource.has(url)) continue;
    seenSource.add(url);
    let host = "source";
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* keep default */
    }
    const key = slugify(host + "-" + (src.title || "src")).slice(0, 48);
    const id = pushNode(nodes, used, {
      id: `news:source:${key}`,
      label: (src.title.trim() || host).slice(0, 64),
      labels: ["NewsSource"],
      properties: {
        id: `news:source:${key}`,
        name: (src.title.trim() || host).slice(0, 200),
        title: (src.title.trim() || host).slice(0, 200),
        url: url.slice(0, 2000),
        canonicalKey: `source:${key}`,
        storyId,
      },
    });
    links.push({
      id: `cites:${storyId}:${key}`,
      source: articleId,
      target: id,
      type: "CITES",
      properties: {},
    });
  }

  return dedupeGraphPayload({ nodes, links });
}
