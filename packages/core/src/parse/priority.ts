/** Map a 0..3 Jev score ladder onto P3–P0 labels. */
export const PRIORITY_LEVELS = ["p3", "p2", "p1", "p0"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  p3: "P3 · Low",
  p2: "P2 · Medium",
  p1: "P1 · High",
  p0: "P0 · Critical",
};

export function priorityFromScore(score: number): PriorityLevel {
  if (score >= 2.5) return "p0";
  if (score >= 1.5) return "p1";
  if (score >= 0.75) return "p2";
  return "p3";
}

/** Map a 0..2 answer-quality score onto labels. */
export function qualityLabel(score: number): string {
  if (score >= 1.5) return "Good";
  if (score >= 0.75) return "Acceptable";
  return "Poor";
}
