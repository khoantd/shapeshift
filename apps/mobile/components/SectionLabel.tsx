import { Text, type TextStyle } from "react-native";
import { useMeanboxTheme } from "../theme";

export function SectionLabel({
  children,
  style,
}: {
  children: string;
  style?: TextStyle;
}) {
  const { color, typography, spacing } = useMeanboxTheme();
  return (
    <Text
      style={[
        {
          color: color.mutedForeground,
          fontSize: typography.scale.micro.fontSize,
          fontWeight: "500",
          letterSpacing: 0.6,
          marginBottom: spacing.sectionGap,
          marginTop: spacing.sectionGapLg,
        },
        style,
      ]}
    >
      {children.toUpperCase()}
    </Text>
  );
}
