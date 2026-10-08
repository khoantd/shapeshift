import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { RepoExplainerVideoProps } from "./types";

export type { RepoExplainerVideoProps, VideoChapterProps } from "./types";

const COLORS = {
  bg: "#0c0e12",
  fg: "#f4f4f5",
  muted: "#a1a1aa",
  dim: "#71717a",
  border: "#27272a",
  accent: "#e4e4e7",
  line: "#3f3f46",
};

const FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function SceneBackdrop() {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at 12% 0%, #1a2030 0%, ${COLORS.bg} 55%, #090b0f 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          opacity: 0.35,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          backgroundPosition: "center",
        }}
      />
    </AbsoluteFill>
  );
}

function splitBodyChunks(body: string): string[] {
  const parts = body
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 3) return parts.length ? parts : [body];
  const chunkSize = Math.ceil(parts.length / 3);
  const chunks: string[] = [];
  for (let i = 0; i < parts.length; i += chunkSize) {
    chunks.push(parts.slice(i, i + chunkSize).join(" "));
  }
  return chunks.slice(0, 3);
}

function TitleCard({
  fullName,
  description,
}: {
  fullName: string;
  description: string | null;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const eyebrowOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });
  const barWidth = interpolate(frame, [6, 22], [0, 120], {
    extrapolateRight: "clamp",
  });
  const descOpacity = interpolate(frame, [14, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [38, 45], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <SceneBackdrop />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: COLORS.dim,
            fontFamily: FONT,
            marginBottom: 20,
            opacity: eyebrowOpacity,
          }}
        >
          Repository explainer
        </div>
        <div
          style={{
            width: barWidth,
            height: 3,
            backgroundColor: COLORS.accent,
            marginBottom: 28,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            fontSize: 64,
            fontWeight: 650,
            color: COLORS.fg,
            fontFamily: FONT,
            lineHeight: 1.08,
            maxWidth: 1000,
            transform: `translateY(${(1 - enter) * 28}px)`,
            opacity: enter,
          }}
        >
          {fullName}
        </div>
        {description ? (
          <div
            style={{
              marginTop: 28,
              fontSize: 26,
              color: COLORS.muted,
              fontFamily: FONT,
              lineHeight: 1.4,
              maxWidth: 900,
              opacity: descOpacity,
              transform: `translateY(${(1 - descOpacity) * 12}px)`,
            }}
          >
            {description}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function ChapterScene({
  index,
  total,
  title,
  body,
  audioSrc,
  durationInFrames,
}: {
  index: number;
  total: number;
  title: string;
  body: string;
  audioSrc: string;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 140 },
  });
  const exitStart = Math.max(0, durationInFrames - 8);
  const exit = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = interpolate(
    frame,
    [0, Math.max(1, durationInFrames - 1)],
    [0, 1],
    { extrapolateRight: "clamp" },
  );
  const chapterProgress = (index + progress) / total;
  const chunks = splitBodyChunks(body);
  const chunkWindow = Math.max(12, Math.floor(durationInFrames * 0.12));

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <SceneBackdrop />
      {audioSrc ? <Audio src={audioSrc} /> : null}
      <AbsoluteFill style={{ padding: 64 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
            opacity: interpolate(frame, [0, 8], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              backgroundColor: "rgba(20,24,32,0.75)",
              fontFamily: FONT,
              fontSize: 16,
              color: COLORS.muted,
              letterSpacing: 0.5,
            }}
          >
            <span style={{ color: COLORS.fg, fontWeight: 600 }}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span style={{ color: COLORS.dim }}>/</span>
            <span>{String(total).padStart(2, "0")}</span>
          </div>
          <div
            style={{
              width: 220,
              height: 4,
              borderRadius: 999,
              backgroundColor: COLORS.border,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min(100, chapterProgress * 100)}%`,
                height: "100%",
                backgroundColor: COLORS.accent,
                borderRadius: 999,
              }}
            />
          </div>
        </div>

        <div
          style={{
            fontSize: 48,
            fontWeight: 650,
            color: COLORS.fg,
            fontFamily: FONT,
            lineHeight: 1.12,
            marginBottom: 28,
            maxWidth: 1040,
            transform: `translateY(${(1 - enter) * 24}px)`,
            opacity: enter,
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            maxWidth: 1000,
            borderLeft: `3px solid ${COLORS.line}`,
            paddingLeft: 24,
          }}
        >
          {chunks.map((chunk, i) => {
            const start = 8 + i * chunkWindow;
            const chunkEnter = interpolate(
              frame,
              [start, start + 10],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            return (
              <div
                key={`${i}-${chunk.slice(0, 24)}`}
                style={{
                  fontSize: 28,
                  color: COLORS.accent,
                  fontFamily: FONT,
                  lineHeight: 1.45,
                  opacity: chunkEnter,
                  transform: `translateY(${(1 - chunkEnter) * 14}px)`,
                }}
              >
                {chunk}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const RepoExplainerVideo: React.FC<RepoExplainerVideoProps> = ({
  fullName,
  description,
  chapters,
  titleDurationInFrames,
}) => {
  useVideoConfig();
  let from = titleDurationInFrames;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Sequence durationInFrames={titleDurationInFrames} from={0}>
        <TitleCard fullName={fullName} description={description} />
      </Sequence>
      {chapters.map((chapter, index) => {
        const start = from;
        from += chapter.durationInFrames;
        return (
          <Sequence
            key={`${chapter.title}-${index}`}
            from={start}
            durationInFrames={chapter.durationInFrames}
          >
            <ChapterScene
              index={index}
              total={chapters.length}
              title={chapter.title}
              body={chapter.body}
              audioSrc={chapter.audioSrc}
              durationInFrames={chapter.durationInFrames}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
