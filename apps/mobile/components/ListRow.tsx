import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useMeanboxTheme } from "../theme";

type ListRowProps = {
  title: string;
  meta?: string;
  leading?: ReactNode;
  onPress?: () => void;
  bordered?: boolean;
  card?: boolean;
};

export function ListRow({
  title,
  meta,
  leading,
  onPress,
  bordered = true,
  card = false,
}: ListRowProps) {
  const { color, radius, typography, spacing, icon, shadow } = useMeanboxTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: spacing.touchMin + 20,
          borderBottomWidth: bordered && !card ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: color.border,
          backgroundColor: card ? color.card : "transparent",
          borderRadius: card ? radius.xl : 0,
          borderWidth: card ? StyleSheet.hairlineWidth : 0,
          borderColor: color.border,
          paddingHorizontal: card ? 12 : 0,
          marginBottom: card ? 10 : 0,
          opacity: pressed ? 0.85 : 1,
          ...(card ? shadow.rest : null),
        },
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.col}>
        <Text
          style={{
            color: color.foreground,
            fontSize: typography.scale.callout.fontSize,
            fontWeight: "600",
            lineHeight: typography.scale.callout.lineHeight,
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            style={{
              color: color.mutedForeground,
              fontSize: typography.scale.caption.fontSize,
              lineHeight: typography.scale.caption.lineHeight,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      <ChevronRight
        size={18}
        color={color.mutedForeground}
        strokeWidth={icon.strokeWidth}
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  leading: {},
  col: { flex: 1 },
});
