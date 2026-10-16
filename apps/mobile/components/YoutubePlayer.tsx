import { useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { WebView } from "react-native-webview";
import { ExternalLink, Play } from "lucide-react-native";
import {
  YOUTUBE_EMBED_ORIGIN,
  youtubeEmbedHtml,
  youtubeWatchUrl,
} from "../lib/youtubeUrls";
import { useMeanboxTheme } from "../theme";

type Props = {
  videoId: string;
  /** Player / poster height (16:9 area). */
  height?: number;
  style?: ViewStyle;
};

/**
 * In-app YouTube playback via embed WebView.
 * Poster + play first; loads the embed only after the user taps.
 * Uses html + baseUrl Referer so YouTube does not return Error 153.
 */
export function YoutubePlayer({ videoId, height = 200, style }: Props) {
  const { color, radius, icon, typography, spacing } = useMeanboxTheme();
  const [playing, setPlaying] = useState(false);
  const html = youtubeEmbedHtml(videoId);
  const watch = youtubeWatchUrl(videoId);

  if (!html) return null;

  return (
    <View style={style}>
      <View
        style={[
          styles.frame,
          {
            height,
            backgroundColor: "#0f172a",
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            overflow: "hidden",
          },
        ]}
      >
        {playing ? (
          <WebView
            source={{ html, baseUrl: YOUTUBE_EMBED_ORIGIN }}
            style={styles.webview}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            setSupportMultipleWindows={false}
            accessibilityLabel="YouTube player"
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play video"
            onPress={() => setPlaying(true)}
            style={styles.poster}
          >
            <View
              style={[
                styles.play,
                {
                  width: 54,
                  height: 54,
                  borderRadius: radius.pill,
                  backgroundColor: "rgba(255,255,255,0.22)",
                },
              ]}
            >
              <Play size={24} color="#fff" fill="#fff" strokeWidth={0} />
            </View>
          </Pressable>
        )}
      </View>

      {watch ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open in YouTube"
          onPress={() => void Linking.openURL(watch)}
          style={[
            styles.openYt,
            {
              minHeight: spacing.touchMin,
              borderBottomColor: color.border,
            },
          ]}
        >
          <ExternalLink
            size={16}
            color={color.brand}
            strokeWidth={icon.strokeWidth}
          />
          <Text
            style={{
              color: color.brand,
              fontSize: typography.scale.caption.fontSize,
              fontWeight: "600",
            }}
          >
            Open in YouTube
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%" },
  webview: { flex: 1, backgroundColor: "#000" },
  poster: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  play: { alignItems: "center", justifyContent: "center" },
  openYt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
