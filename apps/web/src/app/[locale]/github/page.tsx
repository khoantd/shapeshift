import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteChrome } from "@/components/SiteChrome";
import { GitHubPageClient } from "@/components/github/GitHubPageClient";
import { githubNewsConfigured } from "@/lib/github/config";
import { youtubeOAuthClientConfigured } from "@/lib/youtube/oauth";
import { getYouTubeOAuthSessionStatus } from "@/lib/youtube/oauthSession";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("GitHub");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function GitHubPage() {
  const t = await getTranslations("GitHub");
  const oauthClientConfigured = youtubeOAuthClientConfigured();
  const headlinesConfigured = githubNewsConfigured();
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
        <GitHubPageClient
          oauthClientConfigured={oauthClientConfigured}
          headlinesConfigured={headlinesConfigured}
          initialOAuthConnected={oauthSession.connected}
          initialOAuthEmail={oauthSession.email}
          initialOAuthHasSub={oauthSession.hasSub}
        />
      </Suspense>
      <SiteChrome />
    </>
  );
}
