import { Suspense } from "react";
import { SiteChrome } from "@/components/SiteChrome";
import { YouTubePageClient } from "@/components/youtube/YouTubePageClient";
import {
  missingYouTubeConfigMessage,
  youtubeConfigured,
} from "@/lib/youtube/client";
import { youtubeOAuthClientConfigured } from "@/lib/youtube/oauth";
import { getYouTubeOAuthSessionStatus } from "@/lib/youtube/oauthSession";
import { hasPerplexityApiKey, MISSING_KEY_MESSAGE } from "@/lib/perplexity/deepDive";

export const metadata = {
  title: "YouTube — Shapeshift",
  description:
    "Search YouTube or paste a link. Sign in with Google to load captions for videos you own; generate a study learning pack.",
};

export default async function YouTubePage() {
  const serverConfigured = youtubeConfigured();
  const perplexityConfigured = hasPerplexityApiKey();
  const oauthClientConfigured = youtubeOAuthClientConfigured();
  const oauthSession = await getYouTubeOAuthSessionStatus();

  return (
    <>
      <Suspense
        fallback={
          <div className="mx-auto max-w-3xl px-4 py-16 text-[15px] text-muted-foreground">
            Loading YouTube…
          </div>
        }
      >
        <YouTubePageClient
          serverConfigured={serverConfigured}
          setupMessage={serverConfigured ? null : missingYouTubeConfigMessage()}
          perplexityConfigured={perplexityConfigured}
          perplexitySetupMessage={perplexityConfigured ? null : MISSING_KEY_MESSAGE}
          youtubeOAuthClientConfigured={oauthClientConfigured}
          initialOAuthConnected={oauthSession.connected}
          initialOAuthEmail={oauthSession.email}
          initialOAuthHasSub={oauthSession.hasSub}
        />
      </Suspense>
      <SiteChrome />
    </>
  );
}
