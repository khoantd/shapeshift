import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMeanboxTheme } from "../theme";

type ScreenHeaderProps = {
  title: string;
  action?: ReactNode;
  onActionPress?: () => void;
  actionLabel?: string;
};

export function ScreenHeader({
  title,
  action,
  onActionPress,
  actionLabel,
}: ScreenHeaderProps) {
  const { color, radius, typography, spacing } = useMeanboxTheme();

  return (
    <View style={[styles.row, { minHeight: spacing.headerHeight }]}>
      <Text
        accessibilityRole="header"
        style={{
          flex: 1,
          color: color.foreground,
          fontSize: typography.scale.title.fontSize,
          fontWeight: "700",
          lineHeight: typography.scale.title.lineHeight,
          letterSpacing: typography.scale.title.letterSpacing,
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.action,
            {
              width: 36,
              height: 36,
              borderRadius: radius.pill,
              backgroundColor: color.muted,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {action}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
  },
});
