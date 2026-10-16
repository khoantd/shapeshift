import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import {
  Globe,
  Info,
  LogIn,
  Server,
} from "lucide-react-native";
import { IconTile } from "../../components/IconTile";
import { ListRow } from "../../components/ListRow";
import { MeanboxLogo } from "../../components/MeanboxLogo";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { oauthStartUrl } from "../../lib/apiCore";
import { useSettings } from "../../lib/SettingsProvider";
import { type MeanboxLocale } from "../../lib/settingsCore";
import { useMeanboxTheme } from "../../theme";

export default function MoreScreen() {
  const { color, typography, spacing, icon, radius } = useMeanboxTheme();
  const { settings, setApiBase, setLocale } = useSettings();
  const [editingBase, setEditingBase] = useState(false);
  const [baseDraft, setBaseDraft] = useState(settings.apiBase);

  const saveBase = async () => {
    try {
      await setApiBase(baseDraft);
      setEditingBase(false);
    } catch (e) {
      Alert.alert(
        "Invalid API base",
        e instanceof Error ? e.message : "Use an http(s) URL",
      );
    }
  };

  const toggleLocale = async () => {
    const next: MeanboxLocale = settings.locale === "en" ? "vi" : "en";
    await setLocale(next);
  };

  const signIn = async () => {
    await WebBrowser.openBrowserAsync(oauthStartUrl(settings.apiBase));
  };

  return (
    <Screen>
      <ScreenHeader title="More" />
      <View style={styles.hero}>
        <MeanboxLogo variant="lockup" height={40} />
        <Text
          style={{
            color: color.mutedForeground,
            fontSize: typography.scale.caption.fontSize,
            marginTop: 12,
          }}
        >
          Account, locale, and API settings
        </Text>
      </View>

      <ListRow
        title="Sign in"
        meta="Open Meanbox Google sign-in in the browser"
        onPress={() => void signIn()}
        leading={
          <IconTile tone="brand">
            <LogIn size={18} color={color.brand} strokeWidth={icon.strokeWidth} />
          </IconTile>
        }
      />
      <ListRow
        title="Language"
        meta={settings.locale === "vi" ? "Tiếng Việt" : "English"}
        onPress={() => void toggleLocale()}
        leading={
          <IconTile>
            <Globe size={18} color={color.ink2} strokeWidth={icon.strokeWidth} />
          </IconTile>
        }
      />
      <ListRow
        title="API base"
        meta={settings.apiBase}
        onPress={() => {
          setBaseDraft(settings.apiBase);
          setEditingBase((v) => !v);
        }}
        leading={
          <IconTile>
            <Server size={18} color={color.ink2} strokeWidth={icon.strokeWidth} />
          </IconTile>
        }
      />

      {editingBase ? (
        <View style={{ marginBottom: 12, gap: 8 }}>
          <TextInput
            accessibilityLabel="API base URL"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={baseDraft}
            onChangeText={setBaseDraft}
            placeholder="https://meanbox.vercel.app"
            placeholderTextColor={color.mutedForeground}
            style={{
              borderWidth: 1,
              borderColor: color.border,
              borderRadius: radius.md,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: color.foreground,
              fontSize: typography.scale.body.fontSize,
              backgroundColor: color.card,
              minHeight: spacing.touchMin,
            }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void saveBase()}
            style={{
              alignSelf: "flex-start",
              backgroundColor: color.primary,
              borderRadius: radius.pill,
              paddingHorizontal: 16,
              paddingVertical: 10,
              minHeight: spacing.touchMin,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: color.primaryForeground, fontWeight: "700" }}>
              Save API base
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ListRow
        title="About"
        meta="v0.1.0 · Meanbox mobile"
        bordered={false}
        onPress={() =>
          void Linking.openURL(settings.apiBase)
        }
        leading={
          <IconTile>
            <Info size={18} color={color.ink2} strokeWidth={icon.strokeWidth} />
          </IconTile>
        }
      />
      <View style={{ height: spacing.sectionGap }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingVertical: 24,
    marginBottom: 8,
  },
});
