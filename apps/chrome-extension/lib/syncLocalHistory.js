import {
  clipNewsArticle,
  generateNewsDeepDive,
  hasMeanboxSession,
  importLearningPack,
} from "./api.js";
import { getSettings } from "./config.js";
import {
  SYNCABLE_KINDS,
  listPendingSync,
  markSynced,
  patchLocalPayload,
  writeSyncMeta,
} from "./localHistory.js";

/**
 * @returns {Promise<{ synced: number, skipped: number, failed: number, message: string }>}
 */
export async function syncPendingLocalHistory() {
  const { apiBase } = await getSettings();
  if (!(await hasMeanboxSession(apiBase))) {
    const message = "No Meanbox session — sign in on the API base to sync.";
    await writeSyncMeta({ lastSyncMessage: message });
    return { synced: 0, skipped: 0, failed: 0, message };
  }

  const pending = await listPendingSync(apiBase);
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of pending) {
    if (!SYNCABLE_KINDS.has(item.kind)) {
      skipped += 1;
      continue;
    }
    try {
      if (item.kind === "learning_pack") {
        const p = item.payload || {};
        const res = await importLearningPack({
          videoId: String(p.videoId || ""),
          title: String(p.title || ""),
          channelTitle: p.channelTitle ? String(p.channelTitle) : undefined,
          contentType: p.contentType ? String(p.contentType) : undefined,
          markdown: String(p.markdown || ""),
          transcript: String(p.transcript || ""),
        });
        if (res?.saved) {
          await markSynced(item.id);
          synced += 1;
        } else {
          failed += 1;
        }
        continue;
      }

      if (item.kind === "news_deep_dive") {
        const p = item.payload || {};
        let storyId =
          typeof p.storyId === "string" ? p.storyId.trim() : "";
        if (!storyId) {
          const clipped = await clipNewsArticle({
            title: String(p.title || ""),
            excerpt: String(p.excerpt || ""),
            canonicalUrl: p.canonicalUrl ? String(p.canonicalUrl) : undefined,
          });
          storyId = typeof clipped?.id === "string" ? clipped.id.trim() : "";
          if (storyId) {
            await patchLocalPayload(item.id, { storyId });
          }
        }
        if (storyId) {
          await generateNewsDeepDive({
            title: String(p.title || ""),
            excerpt: String(p.excerpt || ""),
            canonicalUrl: p.canonicalUrl ? String(p.canonicalUrl) : undefined,
            id: storyId,
            force: false,
          });
          await markSynced(item.id);
          synced += 1;
        } else {
          failed += 1;
        }
        continue;
      }

      skipped += 1;
    } catch {
      failed += 1;
    }
  }

  const message =
    synced > 0
      ? `Synced ${synced} item${synced === 1 ? "" : "s"} to Meanbox.`
      : failed > 0
        ? "Sync finished with errors — try again from Options."
        : skipped > 0 && pending.length === skipped
          ? "Nothing to upload yet (some items stay on this device only)."
          : "Nothing pending to sync.";
  await writeSyncMeta({
    lastSyncAt: Date.now(),
    lastSyncMessage: message,
    lastSyncCounts: { synced, skipped, failed },
  });
  return { synced, skipped, failed, message };
}
