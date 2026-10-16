import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Search, X } from "lucide-react-native";
import { Chip } from "../../components/Chip";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { fetchNews } from "../../lib/api";
import {
  formatRelativeTime,
  newsCategoryMatch,
  type NewsFeedItem,
} from "../../lib/apiCore";
import { useSettings } from "../../lib/SettingsProvider";
import { useMeanboxTheme } from "../../theme";

const CATEGORIES = ["Top", "Tech", "World", "Science"] as const;

export default function NewsScreen() {
  const { color, typography, spacing, icon, radius } = useMeanboxTheme();
  const { settings } = useSettings();
  const router = useRouter();
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("Top");
  const [items, setItems] = useState<NewsFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (opts: { soft?: boolean } = {}) => {
      if (!opts.soft) setLoading(true);
      setError(null);
      try {
        const res = await fetchNews({
          q: query.trim() || undefined,
          limit: 50,
          apiBase: settings.apiBase,
        });
        if (!res.success) {
          setItems([]);
          setError(res.error || "Could not load news");
          return;
        }
        setItems(Array.isArray(res.items) ? res.items : []);
      } catch (e) {
        setItems([]);
        setError(e instanceof Error ? e.message : "Could not load news");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query, settings.apiBase],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => items.filter((item) => newsCategoryMatch(item, cat)),
    [items, cat],
  );

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load({ soft: true });
          }}
          tintColor={color.brand}
        />
      }
    >
      <ScreenHeader
        title="News"
        actionLabel={searchOpen ? "Close search" : "Search news"}
        action={
          searchOpen ? (
            <X size={18} color={color.ink2} strokeWidth={icon.strokeWidth} />
          ) : (
            <Search size={18} color={color.ink2} strokeWidth={icon.strokeWidth} />
          )
        }
        onActionPress={() => setSearchOpen((v) => !v)}
      />

      {searchOpen ? (
        <TextInput
          accessibilityLabel="Search news"
          placeholder="Search feed…"
          placeholderTextColor={color.mutedForeground}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void load()}
          returnKeyType="search"
          style={{
            borderWidth: 1,
            borderColor: color.border,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginBottom: 12,
            color: color.foreground,
            fontSize: typography.scale.body.fontSize,
            minHeight: spacing.touchMin,
            backgroundColor: color.card,
          }}
        />
      ) : null}

      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={cat === c}
            onPress={() => setCat(c)}
          />
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={color.brand} style={{ marginTop: 24 }} />
      ) : error ? (
        <View style={{ marginTop: spacing.sectionGap }}>
          <Text
            style={{
              color: color.destructive,
              fontSize: typography.scale.body.fontSize,
              marginBottom: 12,
            }}
          >
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load()}
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: radius.pill,
              backgroundColor: color.muted,
              minHeight: spacing.touchMin,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: color.foreground, fontWeight: "600" }}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <Text
          style={{
            marginTop: spacing.sectionGap,
            color: color.mutedForeground,
            fontSize: typography.scale.body.fontSize,
          }}
        >
          No stories in this category.
        </Text>
      ) : (
        filtered.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() =>
              router.push({
                pathname: "/news/[id]",
                params: {
                  id: item.id,
                  title: item.title,
                  excerpt: item.excerpt,
                  canonicalUrl: item.canonicalUrl,
                  source: item.sourceDisplayName ?? "",
                  publishedAt: item.publishedAt,
                },
              })
            }
            style={[styles.item, { borderBottomColor: color.border }]}
          >
            <Text
              style={{
                color: item.isPinned ? color.brand : color.mutedForeground,
                fontSize: typography.scale.micro.fontSize,
                fontWeight: "500",
                letterSpacing: 0.4,
                marginBottom: 6,
              }}
            >
              {(item.sourceDisplayName || "NEWS").toUpperCase()}
              {item.publishedAt
                ? ` · ${formatRelativeTime(item.publishedAt)}`
                : ""}
            </Text>
            <Text
              style={{
                color: color.foreground,
                fontSize: typography.scale.callout.fontSize,
                fontWeight: "700",
                lineHeight: typography.scale.callout.lineHeight,
                marginBottom: 4,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{
                color: color.mutedForeground,
                fontSize: typography.scale.caption.fontSize,
                lineHeight: typography.scale.caption.lineHeight,
              }}
              numberOfLines={2}
            >
              {item.excerpt}
            </Text>
          </Pressable>
        ))
      )}
      <View style={{ height: spacing.sectionGap }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  item: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
