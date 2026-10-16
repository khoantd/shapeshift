import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { ReaderPane } from "../../components/ReaderPane";
import { Screen } from "../../components/Screen";
import { generateNewsDeepDive } from "../../lib/api";
import { formatRelativeTime } from "../../lib/apiCore";
import { useSettings } from "../../lib/SettingsProvider";
import { deepDiveLanguage, meanboxHref } from "../../lib/settingsCore";
import { useMeanboxTheme } from "../../theme";

export default function NewsDeepDiveScreen() {
  const { color, typography, spacing, icon, radius } = useMeanboxTheme();
  const { settings } = useSettings();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    excerpt?: string;
    canonicalUrl?: string;
    source?: string;
    publishedAt?: string;
  }>();

  const id = String(params.id || "");
  const title = String(params.title || "Story");
  const excerpt = String(params.excerpt || "");
  const canonicalUrl = String(params.canonicalUrl || "");
  const source = String(params.source || "");
  const publishedAt = String(params.publishedAt || "");

  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [citeSources, setCiteSources] = useState<
    Array<{ title: string; url: string; id?: number }>
  >([]);
  const [related, setRelated] = useState<
    Array<{ id: string; title: string; url: string }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateNewsDeepDive({
        id: id || undefined,
        title,
        excerpt,
        canonicalUrl: canonicalUrl || undefined,
        language: deepDiveLanguage(settings.locale),
        apiBase: settings.apiBase,
      });
      if (!res.success || !res.text) {
        setError(res.error || "Deep dive failed");
        setBody(excerpt);
        setCiteSources([]);
        return;
      }
      setBody(res.text);
      const sources = (res.sources ?? []).filter((s) => s.title && s.url);
      setCiteSources(
        sources.map((s) =>
          typeof s.id === "number"
            ? { title: s.title, url: s.url, id: s.id }
            : { title: s.title, url: s.url },
        ),
      );
      setRelated(
        sources.slice(0, 5).map((s, i) => ({
          id: `s${i}`,
          title: s.title,
          url: s.url,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deep dive failed");
      setBody(excerpt);
      setCiteSources([]);
    } finally {
      setLoading(false);
    }
  }, [id, title, excerpt, canonicalUrl, settings.apiBase, settings.locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const meta = [
    source || null,
    publishedAt ? formatRelativeTime(publishedAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Screen padTabBar={false}>
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={[
            styles.back,
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
            color: color.mutedForeground,
            fontSize: typography.scale.caption.fontSize,
            fontWeight: "600",
          }}
        >
          Deep dive
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={color.brand} style={{ marginTop: 32 }} />
      ) : (
        <>
          {error ? (
            <Text
              style={{
                color: color.caution,
                fontSize: typography.scale.caption.fontSize,
                marginBottom: 12,
              }}
            >
              {error}
            </Text>
          ) : null}
          <ReaderPane
            title={title}
            meta={meta}
            body={body || excerpt}
            sources={citeSources}
            openUrl={
              id
                ? meanboxHref(`/news?story=${encodeURIComponent(id)}`, settings)
                : canonicalUrl || undefined
            }
            related={related.map((r) => ({
              id: r.id,
              title: r.title,
              onPress: () => void Linking.openURL(r.url),
            }))}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  back: {
    alignItems: "center",
    justifyContent: "center",
  },
});
