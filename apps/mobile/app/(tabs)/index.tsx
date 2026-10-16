import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  Camera,
  Link2,
  Split,
  User,
} from "lucide-react-native";
import { Chip } from "../../components/Chip";
import { IconTile } from "../../components/IconTile";
import { ListRow } from "../../components/ListRow";
import { MeanboxLogo } from "../../components/MeanboxLogo";
import { Screen } from "../../components/Screen";
import { SectionLabel } from "../../components/SectionLabel";
import { classifyIntent } from "../../lib/api";
import { intentTopKey } from "../../lib/apiCore";
import { isQuickGadgetIntent } from "../../lib/gadgets";
import { appendRecent, loadRecent } from "../../lib/recent";
import {
  filterRecentItems,
  pageRecentItems,
  RECENT_PAGE_SIZE,
  type RecentItem,
  type RecentKind,
} from "../../lib/recentCore";
import { useSettings } from "../../lib/SettingsProvider";
import { meanboxHref } from "../../lib/settingsCore";
import { useMeanboxTheme } from "../../theme";

const askChips = ["Ask", "Summarize", "Translate"] as const;

export default function AskScreen() {
  const { color, radius, typography, spacing, shadow, icon } =
    useMeanboxTheme();
  const { settings } = useSettings();
  const router = useRouter();
  const [chip, setChip] = useState<(typeof askChips)[number]>("Ask");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [recentQ, setRecentQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void loadRecent().then(setRecent);
  }, []);

  const filteredRecent = useMemo(
    () => pageRecentItems(filterRecentItems(recent, recentQ), page),
    [recent, recentQ, page],
  );
  const filteredTotal = useMemo(
    () => filterRecentItems(recent, recentQ).length,
    [recent, recentQ],
  );

  const placeholder =
    chip === "Summarize"
      ? "Paste a link or article to summarize…"
      : chip === "Translate"
        ? "Text to translate…"
        : "Ask anything or paste a link...";

  const seedText = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) return "";
      if (chip === "Summarize" && !/^summar/i.test(t)) return `Summarize: ${t}`;
      if (chip === "Translate" && !/^translat/i.test(t))
        return `Translate: ${t}`;
      return t;
    },
    [chip],
  );

  const routeIntent = useCallback(
    async (text: string, top: string) => {
      const hrefOpen = meanboxHref(
        `/?q=${encodeURIComponent(text)}`,
        settings,
      );

      if (top === "news" || top === "link") {
        await appendRecent({
          title: text,
          meta: "News · just now",
          kind: "news",
        }).then(setRecent);
        router.push("/(tabs)/news");
        return;
      }
      if (top === "youtube" || top === "video") {
        await appendRecent({
          title: text,
          meta: "Study · just now",
          kind: "study",
        }).then(setRecent);
        router.push({
          pathname: "/(tabs)/study",
          params: { q: text },
        });
        return;
      }
      if (isQuickGadgetIntent(top) || top === "tip" || top === "split" || top === "convert" || top === "timer" || top === "rtcfc") {
        const intent = isQuickGadgetIntent(top) ? top : "tip";
        await appendRecent({
          title: text,
          meta: `Gadget · ${intent}`,
          kind: (intent === "split" ? "split" : "gadget") as RecentKind,
        }).then(setRecent);
        router.push({
          pathname: "/(tabs)/tools",
          params: { gadget: intent, q: text },
        });
        return;
      }

      setStatus(`Intent: ${top} — opening Meanbox`);
      await appendRecent({
        title: text,
        meta: `${top} · just now`,
        kind: "ask",
        href: hrefOpen,
      }).then(setRecent);
      await Linking.openURL(hrefOpen);
    },
    [router, settings],
  );

  const onSend = useCallback(async () => {
    const text = seedText(query);
    if (!text || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      let top = "none";
      try {
        const result = await classifyIntent(text, settings.apiBase);
        top = intentTopKey(result);
      } catch {
        const lower = text.toLowerCase();
        if (/\b(news|article|headline)\b/.test(lower)) top = "news";
        else if (/\b(youtube|video|lecture|watch)\b/.test(lower)) top = "youtube";
        else if (/\b(tip|split|convert|timer|rtcfc)\b/.test(lower)) {
          if (/\btip\b/.test(lower)) top = "tip";
          else if (/\bsplit\b/.test(lower)) top = "split";
          else if (/\bconvert\b/.test(lower)) top = "convert";
          else if (/\btimer\b/.test(lower)) top = "timer";
          else top = "rtcfc";
        }
      }
      await routeIntent(text, top);
      setQuery("");
    } finally {
      setBusy(false);
    }
  }, [seedText, query, busy, settings.apiBase, routeIntent]);

  return (
    <Screen>
      <View style={styles.header}>
        <MeanboxLogo variant="lockup" height={28} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          onPress={() => router.push("/(tabs)/more")}
          style={[
            styles.avatar,
            {
              width: 34,
              height: 34,
              borderRadius: radius.pill,
              borderColor: color.border,
            },
          ]}
        >
          <User size={18} color={color.mutedForeground} strokeWidth={icon.strokeWidth} />
        </Pressable>
      </View>

      <Text
        style={{
          color: color.mutedForeground,
          fontSize: typography.scale.callout.fontSize,
          marginTop: spacing.sectionGap,
        }}
      >
        Good morning
      </Text>
      <Text
        accessibilityRole="header"
        style={{
          color: color.foreground,
          fontSize: typography.scale.display.fontSize,
          fontWeight: "700",
          lineHeight: typography.scale.display.lineHeight,
          letterSpacing: typography.scale.display.letterSpacing,
          marginTop: 4,
          marginBottom: spacing.sectionGapLg,
        }}
      >
        What&apos;s on your mind?
      </Text>

      <View style={styles.chips}>
        {askChips.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={chip === c}
            onPress={() => setChip(c)}
          />
        ))}
      </View>

      <View
        style={[
          styles.intent,
          {
            borderRadius: radius.shell,
            backgroundColor: color.card,
            ...shadow.lift,
          },
        ]}
      >
        <TextInput
          accessibilityLabel="Ask anything or paste a link"
          placeholder={placeholder}
          placeholderTextColor={color.mutedForeground}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void onSend()}
          returnKeyType="send"
          style={{
            flex: 1,
            fontSize: typography.scale.body.fontSize,
            color: color.foreground,
            paddingVertical: 8,
            minHeight: spacing.touchMin,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={busy || !query.trim()}
          onPress={() => void onSend()}
          style={[
            styles.send,
            {
              width: spacing.touchMin,
              height: spacing.touchMin,
              borderRadius: radius.pill,
              backgroundColor: color.primary,
              opacity: busy || !query.trim() ? 0.5 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={color.primaryForeground} />
          ) : (
            <ArrowRight
              size={20}
              color={color.primaryForeground}
              strokeWidth={icon.strokeWidth}
            />
          )}
        </Pressable>
      </View>

      {status ? (
        <Text
          style={{
            marginTop: 10,
            color: color.mutedForeground,
            fontSize: typography.scale.caption.fontSize,
          }}
        >
          {status}
        </Text>
      ) : null}

      <SectionLabel>Recent</SectionLabel>
      {recent.length > RECENT_PAGE_SIZE ? (
        <TextInput
          accessibilityLabel="Search recent"
          placeholder="Search recent…"
          placeholderTextColor={color.mutedForeground}
          value={recentQ}
          onChangeText={(t) => {
            setRecentQ(t);
            setPage(1);
          }}
          style={{
            borderWidth: 1,
            borderColor: color.border,
            borderRadius: radius.md,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 10,
            color: color.foreground,
            fontSize: typography.scale.caption.fontSize,
            backgroundColor: color.card,
          }}
        />
      ) : null}

      {filteredRecent.length === 0 ? (
        <Text
          style={{
            color: color.mutedForeground,
            fontSize: typography.scale.body.fontSize,
          }}
        >
          Your recent asks will show up here.
        </Text>
      ) : (
        filteredRecent.map((item) => (
          <ListRow
            key={item.id}
            title={item.title}
            meta={item.meta}
            onPress={
              item.href
                ? () => void Linking.openURL(item.href!)
                : undefined
            }
            leading={
              <IconTile>
                {item.kind === "link" || item.kind === "news" ? (
                  <Link2 size={18} color={color.ink2} strokeWidth={icon.strokeWidth} />
                ) : item.kind === "split" || item.kind === "gadget" ? (
                  <Split size={18} color={color.ink2} strokeWidth={icon.strokeWidth} />
                ) : (
                  <Camera size={18} color={color.ink2} strokeWidth={icon.strokeWidth} />
                )}
              </IconTile>
            }
          />
        ))
      )}

      {filteredTotal > filteredRecent.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setPage((p) => p + 1)}
          style={{
            alignSelf: "center",
            marginTop: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: radius.pill,
            backgroundColor: color.muted,
            minHeight: spacing.touchMin,
            justifyContent: "center",
          }}
        >
          <Text style={{ color: color.foreground, fontWeight: "600" }}>
            Load more
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatar: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  intent: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 8,
  },
  send: { alignItems: "center", justifyContent: "center" },
});
