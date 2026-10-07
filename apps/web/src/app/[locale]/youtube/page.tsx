import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteChrome } from "@/components/SiteChrome";
import { YouTubePageClient } from "@/components/youtube/YouTubePageClient";
import {
  missingYouTubeConfigMessage,
  youtubeConfigured,
} from "@/lib/youtube/client";
import { youtubeOAuthClientConfigured } from "@/lib/youtube/oauth";
import { getYouTubeOAuthSessionStatus } from "@/lib/youtube/oauthSession";
import { hasPerplexityApiKey, MISSING_KEY_MESSAGE } from "@/lib/perplexity/deepDive";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("YouTube");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function YouTubePage() {
  const t = await getTranslations("YouTube");
  const serverConfigured = youtubeConfigured();
  const perplexityConfigured = hasPerplexityApiKey();
  const oauthClientConfigured = youtubeOAuthClientConfigured();
  const oauthSession = await getYouTubeOAuthSessionStatus();

  return (
    <>
      <Suspense
        fallback={
          <div className="mx-auto max-w-3xl px-4 py-16 text-[15px] text-muted-foreground">
            {t("loading")}
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
