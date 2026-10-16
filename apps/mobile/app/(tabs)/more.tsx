import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  LogOut,
  Server,
} from "lucide-react-native";
import { IconTile } from "../../components/IconTile";
import { ListRow } from "../../components/ListRow";
import { MeanboxLogo } from "../../components/MeanboxLogo";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { fetchOAuthSession } from "../../lib/api";
import { oauthStartUrl } from "../../lib/apiCore";
import { useSettings } from "../../lib/SettingsProvider";
import {
  MOBILE_OAUTH_REDIRECT,
  MOBILE_OAUTH_RETURN_TO,
  clearSession,
  loadSession,
  parseMobileOAuthRedirect,
  saveSession,
  type MeanboxSession,
} from "../../lib/session";
import { type MeanboxLocale } from "../../lib/settingsCore";
import { useMeanboxTheme } from "../../theme";

WebBrowser.maybeCompleteAuthSession();

export default function MoreScreen() {
  const { color, typography, spacing, icon, radius } = useMeanboxTheme();
  const { settings, setApiBase, setLocale } = useSettings();
  const [editingBase, setEditingBase] = useState(false);
  const [baseDraft, setBaseDraft] = useState(settings.apiBase);
  const [session, setSession] = useState<MeanboxSession | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const refreshAccount = useCallback(async () => {
    const local = await loadSession();
    setSession(local);
    if (!local?.bridge) {
      setAccountEmail(null);
      return;
    }
    try {
      const status = await fetchOAuthSession(settings.apiBase);
      if (status.connected) {
        setAccountEmail(status.email || local.email);
      } else {
        setAccountEmail(local.email);
      }
    } catch {
      setAccountEmail(local.email);
    }
  }, [settings.apiBase]);

  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount]);

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
    setAuthBusy(true);
    try {
      const startUrl = oauthStartUrl(settings.apiBase, {
        returnTo: MOBILE_OAUTH_RETURN_TO,
      });
      const result = await WebBrowser.openAuthSessionAsync(
        startUrl,
        MOBILE_OAUTH_REDIRECT,
      );
      if (result.type !== "success" || !("url" in result) || !result.url) {
        if (result.type === "cancel" || result.type === "dismiss") return;
        Alert.alert("Sign-in", "Could not complete Google sign-in.");
        return;
      }
      const parsed = parseMobileOAuthRedirect(result.url);
      if (!parsed.ok) {
        Alert.alert(
          "Sign-in failed",
          parsed.error === "not_connected"
            ? "Google did not return a Meanbox session. Try again."
            : `OAuth error: ${parsed.error}`,
        );
        return;
      }
      await saveSession(parsed.session);
      setSession(parsed.session);
      setAccountEmail(parsed.session.email);
      await refreshAccount();
      Alert.alert(
        "Signed in",
        parsed.session.email
          ? `Connected as ${parsed.session.email}`
          : "Google account connected.",
      );
    } catch (e) {
      Alert.alert(
        "Sign-in failed",
        e instanceof Error ? e.message : "Unexpected error",
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    await clearSession();
    setSession(null);
    setAccountEmail(null);
  };

  const signedIn = Boolean(session?.bridge);

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

      {signedIn ? (
        <>
          <ListRow
            title="Account"
            meta={accountEmail || "Google connected"}
            leading={
              <IconTile tone="brand">
                <LogIn
                  size={18}
                  color={color.brand}
                  strokeWidth={icon.strokeWidth}
                />
              </IconTile>
            }
          />
          <ListRow
            title="Sign out"
            meta="Clear Meanbox session on this device"
            onPress={() => void signOut()}
            leading={
              <IconTile>
                <LogOut
                  size={18}
                  color={color.ink2}
                  strokeWidth={icon.strokeWidth}
                />
              </IconTile>
            }
          />
        </>
      ) : (
        <ListRow
          title={authBusy ? "Signing in…" : "Sign in"}
          meta="Google via Meanbox (session stays in the app)"
          onPress={() => {
            if (!authBusy) void signIn();
          }}
          leading={
            <IconTile tone="brand">
              {authBusy ? (
                <ActivityIndicator color={color.brand} />
              ) : (
                <LogIn
                  size={18}
                  color={color.brand}
                  strokeWidth={icon.strokeWidth}
                />
              )}
            </IconTile>
          }
        />
      )}

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
        onPress={() => void Linking.openURL(settings.apiBase)}
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
