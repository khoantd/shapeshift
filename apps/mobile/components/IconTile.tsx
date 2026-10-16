import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useMeanboxTheme } from "../theme";

export function IconTile({
  children,
  tone = "muted",
  size = 40,
}: {
  children: ReactNode;
  tone?: "muted" | "brand";
  size?: number;
}) {
  const { color, radius } = useMeanboxTheme();
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: tone === "brand" ? color.brandSoft : color.muted,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
  },
});
