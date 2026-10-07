"use client";

import { useEffect, useState } from "react";
import { LogOut, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";

const BUTTON =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border bg-background/90 px-2.5 text-[13px] font-medium text-muted-foreground shadow-xs transition-[color,background-color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96] md:h-8 md:min-h-0";

type Props = {
  clientConfigured: boolean;
  initialConnected: boolean;
  initialEmail: string | null;
};

export function UserProfile({ clientConfigured, initialConnected, initialEmail }: Props) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [connected, setConnected] = useState(initialConnected);
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientConfigured) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/youtube/oauth/session");
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          connected?: boolean;
          email?: string | null;
        };
        if (cancelled) return;
        if (typeof body.connected === "boolean") setConnected(body.connected);
        if (body.email) setEmail(body.email);
      } catch {
        /* keep SSR snapshot */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientConfigured]);

  const returnTo = (() => {
    const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
    if (locale === "en") return path || "/";
    return path === "/" ? `/${locale}` : `/${locale}${path}`;
  })();

  const signInHref = `/api/youtube/oauth/start?returnTo=${encodeURIComponent(returnTo)}`;

  const onSignOut = async () => {
    setBusy(true);
    try {
      await fetch("/api/youtube/oauth/logout", { method: "POST" });
      setConnected(false);
      setEmail(null);
    } finally {
      setBusy(false);
    }
  };

  if (!clientConfigured) {
    return (
      <span
        className={`${BUTTON} cursor-default opacity-60`}
        title={t("userProfileUnavailable")}
        aria-label={t("userProfileUnavailable")}
      >
        <User aria-hidden className="size-4" />
        <span className="hidden sm:inline">{t("userProfile")}</span>
      </span>
    );
  }

  if (connected) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={`${BUTTON} max-w-[11rem] cursor-default sm:max-w-[14rem]`}
          title={email ?? t("userProfile")}
          aria-label={email ? t("userProfileSignedIn", { email }) : t("userProfile")}
        >
          <User aria-hidden className="size-4 shrink-0" />
          <span className="hidden truncate sm:inline">{email ?? t("userProfile")}</span>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSignOut()}
          className={BUTTON}
          aria-label={t("signOut")}
        >
          <LogOut aria-hidden className="size-4" />
          <span className="hidden sm:inline">{t("signOut")}</span>
        </button>
      </div>
    );
  }

  return (
    <a href={signInHref} className={BUTTON} aria-label={t("userProfile")}>
      <User aria-hidden className="size-4" />
      <span className="hidden sm:inline">{t("userProfile")}</span>
    </a>
  );
}
