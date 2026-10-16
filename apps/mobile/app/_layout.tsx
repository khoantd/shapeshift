import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { SettingsProvider } from "../lib/SettingsProvider";
import { MeanboxThemeProvider, useMeanboxTheme } from "../theme";

WebBrowser.maybeCompleteAuthSession();

// Expo Go SDK 57 can ship without matching Fabric screen natives → blank /
// "RNSScreenNavigationContainer" invariant. JS fallback keeps the UI usable.
enableScreens(false);

function RootNav() {
  const { color } = useMeanboxTheme();
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.background },
          animation: "fade",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="news/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="study/[videoId]" options={{ presentation: "card" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <MeanboxThemeProvider>
          <SettingsProvider>
            <RootNav />
          </SettingsProvider>
        </MeanboxThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
