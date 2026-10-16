import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ExternalLink } from "lucide-react-native";
import { MarkdownBody } from "./MarkdownBody";
import type { CiteSource } from "../lib/markdown";
import { useMeanboxTheme } from "../theme";

type RelatedItem = { id: string; title: string; onPress?: () => void };

type Props = {
  title: string;
  meta?: string;
  body: string;
  sources?: readonly CiteSource[];
  openUrl?: string;
  openLabel?: string;
  related?: RelatedItem[];
};

export function ReaderPane({
  title,
  meta,
  body,
  sources = [],
  openUrl,
  openLabel = "Open in Meanbox",
  related = [],
}: Props) {
  const { color, typography, spacing, radius, icon } = useMeanboxTheme();
  const hasBody = String(body ?? "").trim().length > 0;

  return (
    <View>
      {meta ? (
        <Text
          style={{
            color: color.mutedForeground,
            fontSize: typography.scale.caption.fontSize,
            marginBottom: 8,
          }}
        >
          {meta}
        </Text>
      ) : null}
      <Text
        accessibilityRole="header"
        style={{
          color: color.foreground,
          fontSize: typography.scale.title.fontSize,
          fontWeight: "700",
          lineHeight: typography.scale.title.lineHeight,
          marginBottom: spacing.sectionGap,
        }}
      >
        {title}
      </Text>
      {!hasBody ? (
        <Text
          style={{
            color: color.mutedForeground,
            fontSize: typography.scale.body.fontSize,
          }}
        >
          No deep dive yet.
        </Text>
      ) : (
        <MarkdownBody sources={sources}>{body}</MarkdownBody>
      )}

      {related.length > 0 ? (
        <View style={{ marginTop: spacing.sectionGap }}>
          <Text
            style={{
              color: color.mutedForeground,
              fontSize: typography.scale.micro.fontSize,
              fontWeight: "600",
              letterSpacing: 0.6,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Related
          </Text>
          {related.slice(0, 5).map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={r.onPress}
              disabled={!r.onPress}
              style={[styles.related, { borderBottomColor: color.border }]}
            >
              <Text
                style={{
                  color: color.brand,
                  fontSize: typography.scale.callout.fontSize,
                  fontWeight: "600",
                }}
                numberOfLines={2}
              >
                {r.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {openUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={openLabel}
          onPress={() => void Linking.openURL(openUrl)}
          style={[
            styles.open,
            {
              backgroundColor: color.muted,
              borderRadius: radius.pill,
              minHeight: spacing.touchMin,
              marginTop: spacing.sectionGapLg,
            },
          ]}
        >
          <ExternalLink
            size={16}
            color={color.ink2}
            strokeWidth={icon.strokeWidth}
          />
          <Text style={{ color: color.foreground, fontWeight: "600" }}>
            {openLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  related: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  open: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
});
