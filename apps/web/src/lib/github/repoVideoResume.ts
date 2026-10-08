/**
 * Pure helpers for resuming video generation when chapter audio
 * already exists in object storage (skip TTS for those chapters).
 */

/**
 * @deprecated Prefer measureMp3DurationSeconds on real bytes.
 * Kept as a last-resort fallback when bytes are unavailable (~128 kbps).
 */
export function durationSecondsFromAudioBytes(byteLength: number): number {
  if (!Number.isFinite(byteLength) || byteLength <= 0) return 1.2;
  return Math.max(1.2, Math.min(45, byteLength / 16_000));
}

export type ChapterAudioResumePlan = {
  toReuse: number[];
  toNarrate: number[];
};

export function planChapterAudioResume(input: {
  chapterCount: number;
  /** Parallel to chapters: true when mp3 already in MinIO */
  existingFlags: boolean[];
  force?: boolean;
}): ChapterAudioResumePlan {
  const toReuse: number[] = [];
  const toNarrate: number[] = [];
  const force = input.force === true;
  for (let i = 0; i < input.chapterCount; i++) {
    const exists = input.existingFlags[i] === true;
    if (!force && exists) toReuse.push(i);
    else toNarrate.push(i);
  }
  return { toReuse, toNarrate };
}
