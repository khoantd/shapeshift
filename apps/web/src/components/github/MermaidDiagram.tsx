"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  enforceSafeMermaidLinks,
  sanitizeMermaidSourceForRender,
} from "@/lib/github/mermaidSecurity";

export function MermaidDiagram({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const reactId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    const safe = sanitizeMermaidSourceForRender(source);
    setError(null);
    el.innerHTML = "";

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "inherit",
        });
        const id = `gh-mermaid-${reactId}`;
        const { svg } = await mermaid.render(id, safe);
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        enforceSafeMermaidLinks(containerRef.current);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Diagram render failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reactId, source]);

  if (error) {
    return (
      <p className="text-[13px] text-destructive" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className={
        className ??
        "overflow-x-auto rounded-md border border-border bg-background/80 p-3 [&_svg]:mx-auto [&_svg]:max-w-full"
      }
      aria-busy={!error}
    />
  );
}
