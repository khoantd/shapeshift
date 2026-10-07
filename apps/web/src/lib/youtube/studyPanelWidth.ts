/** Desktop Study sidebar width prefs for `/youtube`. */

export const STUDY_PANEL_WIDTH_KEY = "youtube.studyPanelWidth";
export const STUDY_PANEL_DEFAULT_WIDTH = 420;
export const STUDY_PANEL_MIN_WIDTH = 280;
export const STUDY_PANEL_MAX_WIDTH_CAP = 720;
export const STUDY_PANEL_MAX_VIEWPORT_RATIO = 0.5;
export const STUDY_PANEL_WIDTH_STEP = 16;

export function studyPanelMaxWidth(viewportWidth: number): number {
  const fromViewport = Math.floor(viewportWidth * STUDY_PANEL_MAX_VIEWPORT_RATIO);
  return Math.max(
    STUDY_PANEL_MIN_WIDTH,
    Math.min(STUDY_PANEL_MAX_WIDTH_CAP, fromViewport),
  );
}

export function clampStudyPanelWidth(width: number, maxWidth: number): number {
  if (!Number.isFinite(width)) return STUDY_PANEL_DEFAULT_WIDTH;
  return Math.min(maxWidth, Math.max(STUDY_PANEL_MIN_WIDTH, Math.round(width)));
}

export function readStudyPanelWidth(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STUDY_PANEL_WIDTH_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeStudyPanelWidth(width: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STUDY_PANEL_WIDTH_KEY, String(Math.round(width)));
  } catch {
    // Storage full or blocked.
  }
}
