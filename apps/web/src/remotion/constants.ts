/** Shared Remotion composition IDs and timing — no remotion imports. */
export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 720;
export const TITLE_DURATION_FRAMES = 45;
export const COMPOSITION_ID = "RepoExplainer";

/** Map audio seconds → frames with a short ~200ms tail (no long silent pads). */
export function secondsToFrames(seconds: number): number {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return Math.max(Math.ceil(safe * FPS) + 6, FPS);
}
