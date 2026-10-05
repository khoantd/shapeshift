"use client";

import { useEffect, useId, useRef } from "react";

type YtPlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getPlayerState: () => number;
};

type YtPlayerEvent = { target: YtPlayer; data: number };

type YtNamespace = {
  Player: new (
    elementId: string,
    opts: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: YtPlayerEvent) => void;
        onStateChange?: (e: YtPlayerEvent) => void;
      };
    },
  ) => YtPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
};

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_PLAYING = 1;
const POLL_MS = 250;

let apiPromise: Promise<YtNamespace> | null = null;

function loadYouTubeIframeApi(): Promise<YtNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube IFrame API requires a browser"));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube IFrame API failed to load"));
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        apiPromise = null;
        reject(new Error("Failed to load YouTube IFrame API script"));
      };
      document.head.appendChild(script);
    }
    const check = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(check);
        resolve(window.YT);
      }
    }, 50);
    window.setTimeout(() => {
      window.clearInterval(check);
      if (!window.YT?.Player) {
        apiPromise = null;
        reject(new Error("Timed out loading YouTube IFrame API"));
      }
    }, 15_000);
  });

  return apiPromise;
}

export type YouTubePlayerHandle = {
  seekTo: (seconds: number) => void;
};

type Props = {
  videoId: string;
  title: string;
  onTimeUpdate?: (seconds: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  playerRef?: React.MutableRefObject<YouTubePlayerHandle | null>;
};

export function YouTubePlayer({
  videoId,
  title,
  onTimeUpdate,
  onPlayingChange,
  playerRef,
}: Props) {
  const reactId = useId().replace(/:/g, "");
  const elementId = `yt-player-${reactId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<YtPlayer | null>(null);
  const pollRef = useRef<number | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const playerRefProp = useRef(playerRef);
  playerRefProp.current = playerRef;

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);
  useEffect(() => {
    onPlayingChangeRef.current = onPlayingChange;
  }, [onPlayingChange]);

  useEffect(() => {
    let cancelled = false;

    const stopPoll = () => {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const startPoll = (player: YtPlayer) => {
      stopPoll();
      pollRef.current = window.setInterval(() => {
        try {
          const t = player.getCurrentTime();
          if (Number.isFinite(t)) onTimeUpdateRef.current?.(t);
        } catch {
          /* player may be destroyed mid-tick */
        }
      }, POLL_MS);
    };

    const mount = async () => {
      try {
        const YT = await loadYouTubeIframeApi();
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        const host = document.createElement("div");
        host.id = elementId;
        host.style.width = "100%";
        host.style.height = "100%";
        containerRef.current.appendChild(host);

        const origin =
          typeof window !== "undefined" ? window.location.origin : undefined;

        const player = new YT.Player(elementId, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            ...(origin ? { origin } : {}),
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              playerInstanceRef.current = e.target;
              const handle = {
                seekTo: (seconds: number) => {
                  try {
                    e.target.seekTo(seconds, true);
                    onTimeUpdateRef.current?.(seconds);
                  } catch {
                    /* ignore */
                  }
                },
              };
              if (playerRefProp.current) playerRefProp.current.current = handle;
              // Poll even before PLAYING (autoplay / buffering) so overlay can update.
              startPoll(e.target);
              try {
                const t = e.target.getCurrentTime();
                if (Number.isFinite(t)) onTimeUpdateRef.current?.(t);
              } catch {
                /* ignore */
              }
            },
            onStateChange: (e) => {
              if (cancelled) return;
              const playing = e.data === YT_PLAYING;
              onPlayingChangeRef.current?.(playing);
              if (playing || e.data === 3 /* BUFFERING */) startPoll(e.target);
              else if (e.data === 0 /* ENDED */ || e.data === 2 /* PAUSED */) {
                try {
                  const t = e.target.getCurrentTime();
                  if (Number.isFinite(t)) onTimeUpdateRef.current?.(t);
                } catch {
                  /* ignore */
                }
              }
            },
          },
        });
        playerInstanceRef.current = player;
      } catch {
        /* API load failed — leave empty container; poster path still works if user retries */
      }
    };

    void mount();

    return () => {
      cancelled = true;
      stopPoll();
      if (playerRefProp.current) playerRefProp.current.current = null;
      try {
        playerInstanceRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerInstanceRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [videoId, elementId]);

  return (
    <div
      ref={containerRef}
      className="aspect-video h-full w-full bg-black [&_iframe]:h-full [&_iframe]:w-full"
      role="group"
      aria-label={title}
    />
  );
}
