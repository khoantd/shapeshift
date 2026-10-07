import { Link } from "@/i18n/navigation";
import { SiteNav } from "@/components/SiteNav";
import { MeanboxLogo } from "@/components/brand/MeanboxLogo";
import { BrandBackdrop } from "@/components/brand/BrandBackdrop";
import { LanguageSelector } from "@/components/LanguageSelector";
import { UserProfile } from "@/components/UserProfile";
import { getGoogleOAuthSessionStatus } from "@/lib/auth/googleIdentity";

export async function SiteChrome() {
  const session = await getGoogleOAuthSessionStatus();

  return (
    <>
      <style>{`
        body {
          background-color: #fafaf9;
          background-image:
            linear-gradient(rgb(250 250 249 / 0.72), rgb(250 250 249 / 0.78)),
            url("/brand/main.jpg");
          background-size: cover;
          background-position: center top;
          background-attachment: fixed;
          background-repeat: no-repeat;
        }
      `}</style>

      <header className="fixed inset-x-0 top-0 z-40 overflow-hidden border-b border-border/80 pt-[env(safe-area-inset-top)]">
        <BrandBackdrop src="/brand/header.jpg" scrub="medium" position="center bottom" />
        <div className="relative flex h-12 items-center gap-2 bg-background/35 px-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))] backdrop-blur-md sm:gap-4 sm:px-4">
          <Link
            href="/"
            className="inline-flex shrink-0 cursor-pointer items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <MeanboxLogo
              variant="mark"
              className="size-7 object-contain md:hidden"
              priority
            />
            <MeanboxLogo
              variant="lockup"
              className="hidden h-6 w-auto object-contain object-left md:block"
              priority
            />
          </Link>

          <SiteNav />

          <div className="ms-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            <LanguageSelector />
            <UserProfile
              clientConfigured={session.clientConfigured}
              initialConnected={session.connected}
              initialEmail={session.email}
            />
          </div>
        </div>
      </header>
      <a
        href="https://royalsolution.vn"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground focus-visible:outline-ring fixed start-[max(1rem,env(safe-area-inset-left))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 font-mono text-[12px] leading-4 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="decoration-border underline underline-offset-2">Royal Solution</span>
      </a>
    </>
  );
}
