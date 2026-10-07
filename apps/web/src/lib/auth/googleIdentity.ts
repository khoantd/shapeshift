/**
 * Shared Google identity for features that persist user-owned data
 * (YouTube packs, news knowledge graphs). Same OAuth cookies / googleSub.
 */
export {
  applyYouTubeOAuthCookies as applyGoogleOAuthCookies,
  clearYouTubeOAuthCookies as clearGoogleOAuthCookies,
  ensureYouTubeOAuthIdentity as ensureGoogleOAuthIdentity,
  getYouTubeOAuthIdentity as getGoogleOAuthIdentity,
  getYouTubeOAuthSessionStatus as getGoogleOAuthSessionStatus,
  type EnsuredYouTubeIdentity as EnsuredGoogleIdentity,
} from "@/lib/youtube/oauthSession";
