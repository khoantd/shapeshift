import { type ReactElement, type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMeanboxTheme } from "../theme";

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  /** Extra bottom padding above the tab bar */
  padTabBar?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
};

export function Screen({
  children,
  scroll = true,
  style,
  padTabBar = true,
  refreshControl,
}: ScreenProps) {
  const { color, spacing } = useMeanboxTheme();
  const insets = useSafeAreaInsets();
  const bottomPad =
    (padTabBar ? spacing.tabBarHeight + 12 : 0) + insets.bottom;

  const contentStyle = [
    styles.content,
    {
      paddingTop: insets.top + 8,
      paddingHorizontal: spacing.gutterPhone,
      paddingBottom: bottomPad,
      backgroundColor: color.background,
    },
    style,
  ];

  if (!scroll) {
    return <View style={[styles.flex, contentStyle]}>{children}</View>;
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: color.background }]}
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});
