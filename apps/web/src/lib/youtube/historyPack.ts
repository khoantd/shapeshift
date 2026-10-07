import type { GraphPayload } from "@/lib/neo4j/types";

export type HistoryPack = {
  id: string;
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string;
  videoTitle: string;
  channelTitle: string | null;
  contentType: string | null;
  conceptCount: number;
  termCount: number;
  markdown: string;
  transcript: string | null;
  graphPayload: GraphPayload | null;
  createdAt: number;
};

export function formatRelativeTime(ms: number): string {
  const delta = Date.now() - ms;
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}
