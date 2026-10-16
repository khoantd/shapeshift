import { Tabs } from "expo-router";
import {
  BookOpen,
  Menu,
  Newspaper,
  Search,
  SlidersHorizontal,
} from "lucide-react-native";
import { View, type ColorValue } from "react-native";
import { useMeanboxTheme } from "../../theme";

export default function TabsLayout() {
  const { color, spacing, typography, icon, radius } = useMeanboxTheme();

  const wrap =
    (Icon: typeof Search) =>
    ({
      color: tint,
      focused,
    }: {
      color: ColorValue;
      focused: boolean;
      size: number;
    }) => (
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.pill,
          backgroundColor: focused ? color.brandSoft : "transparent",
        }}
      >
        <Icon
          size={22}
          color={typeof tint === "string" ? tint : color.mutedForeground}
          strokeWidth={icon.strokeWidth}
        />
      </View>
    );

  return (
    <Tabs
      // Avoid expo-router SDK 56/57 blank inactive tabs with native screens.
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brand,
        tabBarInactiveTintColor: color.mutedForeground,
        animation: "none",
        tabBarStyle: {
          height: spacing.tabBarHeight + 8,
          paddingTop: 6,
          paddingBottom: 8,
          backgroundColor: color.card,
          borderTopColor: color.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: typography.scale.micro.fontSize,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Ask", tabBarIcon: wrap(Search) }}
      />
      <Tabs.Screen
        name="news"
        options={{ title: "News", tabBarIcon: wrap(Newspaper) }}
      />
      <Tabs.Screen
        name="study"
        options={{ title: "Study", tabBarIcon: wrap(BookOpen) }}
      />
      <Tabs.Screen
        name="tools"
        options={{ title: "Tools", tabBarIcon: wrap(SlidersHorizontal) }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "More", tabBarIcon: wrap(Menu) }}
      />
    </Tabs>
  );
}
