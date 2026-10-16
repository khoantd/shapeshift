import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react-native";
import { Screen } from "../../components/Screen";
import { SectionLabel } from "../../components/SectionLabel";
import { YoutubePlayer } from "../../components/YoutubePlayer";
import {
  fetchSavedLearningPack,
  fetchTranscript,
  fetchVideoDetails,
  generateLearningPack,
  searchYouTube,
  type YouTubeVideo,
} from "../../lib/api";
import { extractChapters, extractKeyPoints } from "../../lib/packMarkdown";
import { useSettings } from "../../lib/SettingsProvider";
import { useMeanboxTheme } from "../../theme";

export default function StudyDetailScreen() {
  const { color, radius, typography, spacing, shadow, icon } =
    useMeanboxTheme();
  const { settings } = useSettings();
  const router = useRouter();
  const params = useLocalSearchParams<{
    videoId: string;
    title?: string;
    channelTitle?: string;
  }>();

  const videoId = String(params.videoId || "");
  const [title, setTitle] = useState(String(params.title || "Video"));
  const [channel, setChannel] = useState(String(params.channelTitle || ""));
  const [seg, setSeg] = useState<"Overview" | "Related">("Overview");
  const [markdown, setMarkdown] = useState("");
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<YouTubeVideo[]>([]);

  const keyPoints = useMemo(() => extractKeyPoints(markdown), [markdown]);
  const chapters = useMemo(() => extractChapters(markdown), [markdown]);

  const loadContext = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    setError(null);
    try {
      const details = await fetchVideoDetails(videoId, settings.apiBase);
      if (details.video?.title) setTitle(details.video.title);
      if (details.video?.channelTitle) setChannel(details.video.channelTitle);

      const saved = await fetchSavedLearningPack(videoId, settings.apiBase);
      if (saved.pack?.markdown) {
        setMarkdown(saved.pack.markdown);
        setSaveHint(null);
      } else if (saved.unauthorized) {
        setSaveHint("Sign in on Meanbox to sync saved packs.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load video");
    } finally {
      setLoading(false);
    }
  }, [videoId, settings.apiBase]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const generate = useCallback(async () => {
    if (!videoId) return;
    setGenerating(true);
    setError(null);
    try {
      const tr = await fetchTranscript(videoId, settings.apiBase);
      if (!tr.success || !tr.text?.trim()) {
        setError(
          tr.error ||
            "No transcript available — open Meanbox on the web to paste captions.",
        );
        return;
      }
      const pack = await generateLearningPack({
        videoId,
        title,
        channelTitle: channel || undefined,
        transcript: tr.text,
        apiBase: settings.apiBase,
      });
      if (!pack.success || !pack.text) {
        setError(pack.error || "Pack generation failed");
        return;
      }
      setMarkdown(pack.text);
      if (pack.saved) {
        setSaveHint(null);
      } else {
        setSaveHint(
          pack.saveError ||
            "Generated but not saved — sign in on Meanbox to sync.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pack generation failed");
    } finally {
      setGenerating(false);
    }
  }, [videoId, title, channel, settings.apiBase]);

  const loadRelated = useCallback(async () => {
    const q = title.split(/\s+/).slice(0, 6).join(" ");
    if (!q) return;
    try {
      const res = await searchYouTube(q, settings.apiBase);
      setRelated(
        (res.videos ?? []).filter((v) => v.videoId !== videoId).slice(0, 5),
      );
    } catch {
      setRelated([]);
    }
  }, [title, videoId, settings.apiBase]);

  useEffect(() => {
    if (seg === "Related") void loadRelated();
  }, [seg, loadRelated]);

  return (
    <Screen padTabBar={false}>
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={[
            styles.iconBtn,
            {
              backgroundColor: color.muted,
              borderRadius: radius.pill,
              minHeight: spacing.touchMin,
              minWidth: spacing.touchMin,
            },
          ]}
        >
          <ChevronLeft
            size={22}
            color={color.ink2}
            strokeWidth={icon.strokeWidth}
          />
        </Pressable>
        <Text
          style={{
            flex: 1,
            color: color.foreground,
            fontSize: typography.scale.title.fontSize,
            fontWeight: "700",
          }}
        >
          Study
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          onPress={() => void loadContext()}
          style={[
            styles.iconBtn,
            {
              backgroundColor: color.muted,
              borderRadius: radius.pill,
              minHeight: spacing.touchMin,
              minWidth: spacing.touchMin,
            },
          ]}
        >
          <RefreshCw
            size={18}
            color={color.ink2}
            strokeWidth={icon.strokeWidth}
          />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={color.brand} style={{ marginTop: 24 }} />
      ) : (
        <>
          <View
            style={[
              styles.card,
              {
                backgroundColor: color.card,
                borderRadius: radius.xl,
                ...shadow.lift,
              },
            ]}
          >
            <YoutubePlayer videoId={videoId} height={200} />
            <View style={{ padding: 16, gap: 6 }}>
              <Text
                style={{
                  color: color.mutedForeground,
                  fontSize: typography.scale.caption.fontSize,
                }}
              >
                YouTube · {videoId}
              </Text>
              <Text
                style={{
                  color: color.foreground,
                  fontSize: typography.scale.callout.fontSize,
                  fontWeight: "700",
                }}
              >
                {title}
              </Text>
              {channel ? (
                <Text
                  style={{
                    color: color.mutedForeground,
                    fontSize: typography.scale.caption.fontSize,
                  }}
                >
                  {channel}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Generate learning pack"
                disabled={generating}
                onPress={() => void generate()}
                style={[
                  styles.gen,
                  {
                    backgroundColor: color.primary,
                    borderRadius: radius.pill,
                    minHeight: spacing.touchMin,
                    opacity: generating ? 0.7 : 1,
                    marginTop: 8,
                  },
                ]}
              >
                {generating ? (
                  <ActivityIndicator color={color.primaryForeground} />
                ) : (
                  <Text
                    style={{
                      color: color.primaryForeground,
                      fontWeight: "700",
                    }}
                  >
                    {markdown ? "Regenerate pack" : "Generate pack"}
                  </Text>
                )}
              </Pressable>
              {saveHint ? (
                <Text
                  style={{
                    color: color.caution,
                    fontSize: typography.scale.caption.fontSize,
                    marginTop: 4,
                  }}
                >
                  {saveHint}
                </Text>
              ) : null}
              {error ? (
                <Text
                  style={{
                    color: color.destructive,
                    fontSize: typography.scale.caption.fontSize,
                    marginTop: 4,
                  }}
                >
                  {error}
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.seg,
              {
                backgroundColor: color.muted,
                borderRadius: radius.pill,
                marginTop: spacing.sectionGapLg,
              },
            ]}
          >
            {(["Overview", "Related"] as const).map((s) => {
              const active = seg === s;
              return (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSeg(s)}
                  style={[
                    styles.segBtn,
                    {
                      backgroundColor: active ? color.card : "transparent",
                      borderRadius: radius.pill,
                      ...(active ? shadow.rest : null),
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? color.foreground : color.mutedForeground,
                      fontWeight: "600",
                      fontSize: typography.scale.callout.fontSize,
                    }}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {seg === "Overview" ? (
            markdown ? (
              <>
                <SectionLabel>Key points</SectionLabel>
                {keyPoints.map((p) => (
                  <View key={p} style={styles.kp}>
                    <Check
                      size={18}
                      color={color.brand}
                      strokeWidth={icon.strokeWidth}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: color.foreground,
                        fontSize: typography.scale.body.fontSize,
                        lineHeight: typography.scale.body.lineHeight,
                      }}
                    >
                      {p}
                    </Text>
                  </View>
                ))}
                {chapters.length > 0 ? (
                  <>
                    <SectionLabel>Chapters</SectionLabel>
                    {chapters.map((c) => (
                      <View key={c.id} style={styles.chapter}>
                        <View
                          style={[
                            styles.time,
                            {
                              backgroundColor: color.muted,
                              borderRadius: radius.sm,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: color.ink2,
                              fontSize: typography.scale.micro.fontSize,
                              fontWeight: "500",
                            }}
                          >
                            {c.time}
                          </Text>
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            color: color.foreground,
                            fontSize: typography.scale.callout.fontSize,
                            fontWeight: "500",
                          }}
                        >
                          {c.title}
                        </Text>
                        <ChevronRight
                          size={18}
                          color={color.mutedForeground}
                          strokeWidth={icon.strokeWidth}
                        />
                      </View>
                    ))}
                  </>
                ) : null}
              </>
            ) : (
              <Text
                style={{
                  marginTop: spacing.sectionGapLg,
                  color: color.mutedForeground,
                  fontSize: typography.scale.body.fontSize,
                }}
              >
                Generate a learning pack to see key points and chapters.
              </Text>
            )
          ) : related.length === 0 ? (
            <Text
              style={{
                marginTop: spacing.sectionGapLg,
                color: color.mutedForeground,
                fontSize: typography.scale.body.fontSize,
              }}
            >
              Related videos will appear here.
            </Text>
          ) : (
            related.map((v) => (
              <Pressable
                key={v.videoId}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/study/[videoId]",
                    params: {
                      videoId: v.videoId,
                      title: v.title,
                      channelTitle: v.channelTitle ?? "",
                    },
                  })
                }
                style={[styles.related, { borderBottomColor: color.border }]}
              >
                <Text
                  style={{
                    color: color.foreground,
                    fontWeight: "600",
                    fontSize: typography.scale.callout.fontSize,
                  }}
                  numberOfLines={2}
                >
                  {v.title}
                </Text>
                <Text
                  style={{
                    color: color.mutedForeground,
                    fontSize: typography.scale.caption.fontSize,
                    marginTop: 4,
                  }}
                >
                  {v.channelTitle || "YouTube"}
                </Text>
              </Pressable>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  iconBtn: { alignItems: "center", justifyContent: "center" },
  card: { overflow: "hidden" },
  gen: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  seg: { flexDirection: "row", padding: 4, gap: 4 },
  segBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    minHeight: 44,
  },
  kp: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  chapter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  time: { paddingHorizontal: 8, paddingVertical: 4 },
  related: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
