import { Linking, StyleSheet, Text, View } from "react-native";
import {
  parseMarkdown,
  resolveCiteSources,
  type CiteSource,
  type MdInline,
} from "../lib/markdown";
import { useMeanboxTheme } from "../theme";

type Props = {
  children: string;
  sources?: readonly CiteSource[];
};

export function MarkdownBody({ children, sources = [] }: Props) {
  const { color, typography, spacing } = useMeanboxTheme();
  const trimmed = String(children ?? "").trim();
  if (!trimmed) return null;

  const blocks = parseMarkdown(trimmed);
  const bodySize = typography.scale.body.fontSize;
  const bodyLine = Math.round(bodySize * 1.65);

  return (
    <View style={styles.wrap}>
      {blocks.map((block, i) => {
        const key = `${block.type}-${i}`;

        if (block.type === "hr") {
          return (
            <View
              key={key}
              style={[styles.hr, { backgroundColor: color.border }]}
            />
          );
        }

        if (block.type === "heading") {
          const size =
            block.level <= 1
              ? typography.scale.title.fontSize
              : block.level === 2
                ? Math.round(typography.scale.title.fontSize * 0.92)
                : typography.scale.callout.fontSize;
          return (
            <Text
              key={key}
              accessibilityRole="header"
              style={{
                color: color.foreground,
                fontSize: size,
                fontWeight: "600",
                lineHeight: Math.round(size * 1.35),
                marginTop: i === 0 ? 0 : spacing.sectionGap,
                marginBottom: 8,
              }}
            >
              <InlineText nodes={block.children} sources={sources} />
            </Text>
          );
        }

        if (block.type === "bullet" || block.type === "ordered") {
          const marker =
            block.type === "ordered" ? `${block.index}.` : "•";
          return (
            <View key={key} style={styles.listRow}>
              <Text
                style={{
                  color: color.mutedForeground,
                  fontSize: bodySize,
                  lineHeight: bodyLine,
                  width: 22,
                }}
              >
                {marker}
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: color.ink2,
                  fontSize: bodySize,
                  lineHeight: bodyLine,
                  marginBottom: 8,
                }}
              >
                <InlineText nodes={block.children} sources={sources} />
              </Text>
            </View>
          );
        }

        if (block.type === "blockquote") {
          return (
            <View
              key={key}
              style={[
                styles.quote,
                {
                  borderLeftColor: color.border,
                  marginBottom: 12,
                },
              ]}
            >
              <Text
                style={{
                  color: color.mutedForeground,
                  fontSize: bodySize,
                  lineHeight: bodyLine,
                }}
              >
                <InlineText nodes={block.children} sources={sources} />
              </Text>
            </View>
          );
        }

        return (
          <Text
            key={key}
            style={{
              color: color.ink2,
              fontSize: bodySize,
              lineHeight: bodyLine,
              marginBottom: 14,
            }}
          >
            <InlineText nodes={block.children} sources={sources} />
          </Text>
        );
      })}
    </View>
  );
}

function InlineText({
  nodes,
  sources,
}: {
  nodes: MdInline[];
  sources: readonly CiteSource[];
}) {
  const { color, typography } = useMeanboxTheme();

  return (
    <>
      {nodes.map((node, i) => {
        const key = `${node.type}-${i}`;
        if (node.type === "text") {
          return <Text key={key}>{node.text}</Text>;
        }
        if (node.type === "code") {
          return (
            <Text
              key={key}
              style={{
                fontFamily: "Menlo",
                fontSize: typography.scale.caption.fontSize,
                backgroundColor: color.muted,
                color: color.foreground,
              }}
            >
              {node.text}
            </Text>
          );
        }
        if (node.type === "bold") {
          return (
            <Text key={key} style={{ fontWeight: "600", color: color.foreground }}>
              <InlineText nodes={node.children} sources={sources} />
            </Text>
          );
        }
        if (node.type === "italic") {
          return (
            <Text key={key} style={{ fontStyle: "italic" }}>
              <InlineText nodes={node.children} sources={sources} />
            </Text>
          );
        }
        if (node.type === "link") {
          const href = node.href.trim();
          const safe = /^https?:\/\//i.test(href);
          if (!safe) {
            return (
              <Text key={key} style={{ fontWeight: "600", color: color.foreground }}>
                <InlineText nodes={node.children} sources={sources} />
              </Text>
            );
          }
          return (
            <Text
              key={key}
              accessibilityRole="link"
              style={{
                color: color.brand,
                fontWeight: "600",
                textDecorationLine: "underline",
              }}
              onPress={() => void Linking.openURL(href)}
            >
              <InlineText nodes={node.children} sources={sources} />
            </Text>
          );
        }
        // cite
        const resolved = resolveCiteSources(node.indices, sources);
        const label =
          resolved.length > 0
            ? resolved.length === 1
              ? "1 source"
              : `${resolved.length} sources`
            : node.indices.map((n) => `[${n}]`).join("");
        const firstUrl = resolved[0]?.url;
        if (firstUrl) {
          return (
            <Text
              key={key}
              accessibilityRole="link"
              accessibilityLabel={label}
              style={{
                color: color.mutedForeground,
                fontWeight: "600",
                fontSize: typography.scale.caption.fontSize,
              }}
              onPress={() => void Linking.openURL(firstUrl)}
            >
              {" "}
              {label}
            </Text>
          );
        }
        return (
          <Text
            key={key}
            style={{
              color: color.mutedForeground,
              fontWeight: "500",
              fontSize: typography.scale.caption.fontSize,
            }}
          >
            {" "}
            {label}
          </Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  quote: {
    borderLeftWidth: 2,
    paddingLeft: 12,
  },
  hr: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
});
