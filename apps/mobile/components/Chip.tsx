import { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useMeanboxTheme } from "../theme";

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  style?: ViewStyle;
};

export function Chip({ label, selected, onPress, icon, style }: ChipProps) {
  const { color, radius, typography, spacing } = useMeanboxTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: spacing.touchMin > 32 ? 32 : spacing.touchMin,
          borderRadius: radius.pill,
          backgroundColor: selected ? color.brandSoft : color.muted,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={{
          color: selected ? color.brand : color.foreground,
          fontSize: typography.scale.micro.fontSize,
          fontWeight: "500",
          lineHeight: typography.scale.micro.lineHeight,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  icon: { marginRight: 0 },
});
