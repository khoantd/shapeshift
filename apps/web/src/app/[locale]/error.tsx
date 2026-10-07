"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@shapeshift/react/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Errors");
  const tc = useTranslations("Common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex w-full max-w-[560px] flex-col items-start gap-3 px-4 pt-[22vh]">
      <h1 className="text-[17px] leading-6 font-[550]">{t("unableToLoad")}</h1>
      <p className="text-[15px] leading-[22px] text-ink-2">{t("renderBroke")}</p>
      <Button size="sm" onClick={() => reset()} className="px-4">
        {tc("tryAgain")}
      </Button>
    </main>
  );
}
