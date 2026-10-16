import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Play, Search } from "lucide-react-native";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { searchYouTube, type YouTubeVideo } from "../../lib/api";
import { useSettings } from "../../lib/SettingsProvider";
import { useMeanboxTheme } from "../../theme";

export default function StudyScreen() {
  const { color, radius, typography, spacing, shadow, icon } =
    useMeanboxTheme();
  const { settings } = useSettings();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(String(params.q || ""));
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (override?: string) => {
    const query = (override ?? q).trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const res = await searchYouTube(query, settings.apiBase);
      if (!res.success) {
        setVideos([]);
        setError(res.error || "Search failed");
        return;
      }
      setVideos(Array.isArray(res.videos) ? res.videos : []);
    } catch (e) {
      setVideos([]);
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [q, settings.apiBase]);

  useEffect(() => {
    const seeded = String(params.q || "").trim();
    if (!seeded) return;
    setQ(seeded);
    void runSearch(seeded);
    // Only when Ask (or deep link) seeds q
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  return (
    <Screen>
      <ScreenHeader title="Study" />

      <View
        style={[
          styles.searchRow,
          {
            borderRadius: radius.shell,
            backgroundColor: color.card,
            ...shadow.lift,
          },
        ]}
      >
        <TextInput
          accessibilityLabel="Search YouTube"
          placeholder="Search a lecture or paste a video URL…"
          placeholderTextColor={color.mutedForeground}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => void runSearch()}
          returnKeyType="search"
          style={{
            flex: 1,
            fontSize: typography.scale.body.fontSize,
            color: color.foreground,
            paddingVertical: 10,
            minHeight: spacing.touchMin,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search"
          onPress={() => void runSearch()}
          style={[
            styles.searchBtn,
            {
              width: spacing.touchMin,
              height: spacing.touchMin,
              borderRadius: radius.pill,
              backgroundColor: color.primary,
            },
          ]}
        >
          <Search
            size={18}
            color={color.primaryForeground}
            strokeWidth={icon.strokeWidth}
          />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={color.brand} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text
          style={{
            marginTop: spacing.sectionGap,
            color: color.destructive,
            fontSize: typography.scale.body.fontSize,
          }}
        >
          {error}
        </Text>
      ) : videos.length === 0 ? (
        <Text
          style={{
            marginTop: spacing.sectionGapLg,
            color: color.mutedForeground,
            fontSize: typography.scale.body.fontSize,
          }}
        >
          Search YouTube to open a study companion and generate a learning pack.
        </Text>
      ) : (
        videos.map((v) => (
          <Pressable
            key={v.videoId}
            accessibilityRole="button"
            accessibilityLabel={v.title}
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
            style={[
              styles.card,
              {
                backgroundColor: color.card,
                borderRadius: radius.xl,
                ...shadow.rest,
                marginTop: 12,
              },
            ]}
          >
            <View
              style={[
                styles.thumb,
                {
                  backgroundColor: "#1e293b",
                  borderTopLeftRadius: radius.xl,
                  borderTopRightRadius: radius.xl,
                },
              ]}
            >
              <View
                style={[
                  styles.play,
                  {
                    width: 44,
                    height: 44,
                    borderRadius: radius.pill,
                    backgroundColor: "rgba(255,255,255,0.2)",
                  },
                ]}
              >
                <Play size={20} color="#fff" fill="#fff" strokeWidth={0} />
              </View>
            </View>
            <View style={{ padding: 14, gap: 4 }}>
              <Text
                style={{
                  color: color.foreground,
                  fontSize: typography.scale.callout.fontSize,
                  fontWeight: "700",
                }}
                numberOfLines={2}
              >
                {v.title}
              </Text>
              <Text
                style={{
                  color: color.mutedForeground,
                  fontSize: typography.scale.caption.fontSize,
                }}
                numberOfLines={1}
              >
                {v.channelTitle || "YouTube"}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
    gap: 8,
  },
  searchBtn: { alignItems: "center", justifyContent: "center" },
  card: { overflow: "hidden" },
  thumb: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  play: { alignItems: "center", justifyContent: "center" },
});
