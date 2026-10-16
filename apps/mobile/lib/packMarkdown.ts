/** Lightweight learning-pack markdown → key points + chapters. */

export type PackChapter = { id: string; time: string; title: string };

export function extractKeyPoints(markdown: string, limit = 8): string[] {
  const lines = String(markdown || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const points: string[] = [];
  for (const line of lines) {
    const bullet = line.match(/^[-*•]\s+(.+)/);
    if (bullet?.[1]) {
      points.push(bullet[1].replace(/\*\*/g, "").trim());
    } else if (/^\d+[.)]\s+/.test(line)) {
      points.push(line.replace(/^\d+[.)]\s+/, "").replace(/\*\*/g, "").trim());
    }
    if (points.length >= limit) break;
  }
  if (points.length > 0) return points;

  const paras = String(markdown || "")
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40);
  return paras.slice(0, Math.min(3, limit));
}

export function extractChapters(markdown: string, limit = 12): PackChapter[] {
  const chapters: PackChapter[] = [];
  const lines = String(markdown || "").split(/\n+/);
  let i = 0;
  for (const line of lines) {
    const h = line.match(/^#{2,3}\s+(.+)/);
    const timed = line.match(
      /^(?:[-*•]\s+)?(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?\s+[-–—]?\s*(.+)$/,
    );
    if (h?.[1]) {
      i += 1;
      chapters.push({
        id: `c${i}`,
        time: "—",
        title: h[1].replace(/\*\*/g, "").trim(),
      });
    } else if (timed?.[1] && timed[2]) {
      i += 1;
      chapters.push({
        id: `c${i}`,
        time: timed[1],
        title: timed[2].replace(/\*\*/g, "").trim(),
      });
    }
    if (chapters.length >= limit) break;
  }
  return chapters;
}
