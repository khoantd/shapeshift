import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Camera,
  Copy,
  Frame,
  Percent,
  Plus,
  Search,
  Sparkles,
  Split,
  Timer,
  ArrowLeftRight,
} from "lucide-react-native";
import { Chip } from "../../components/Chip";
import { IconTile } from "../../components/IconTile";
import { ListRow } from "../../components/ListRow";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionLabel } from "../../components/SectionLabel";
import { structureRtcfc } from "../../lib/api";
import {
  exampleSeed,
  gadgetFromRtcfc,
  isQuickGadgetIntent,
  resolveQuickGadget,
  rollRtcfcGadget,
  type GadgetResult,
  type QuickGadgetIntent,
} from "../../lib/gadgets";
import { useSettings } from "../../lib/SettingsProvider";
import { meanboxHref } from "../../lib/settingsCore";
import { useMeanboxTheme } from "../../theme";

const gadgets: Array<{ id: QuickGadgetIntent; label: string }> = [
  { id: "tip", label: "Tip" },
  { id: "split", label: "Split" },
  { id: "convert", label: "Convert" },
  { id: "timer", label: "Timer" },
  { id: "rtcfc", label: "RTCFC" },
];

const gadgetIcons = {
  tip: Percent,
  split: Split,
  convert: ArrowLeftRight,
  timer: Timer,
  rtcfc: Frame,
} as const;

export default function ToolsScreen() {
  const { color, radius, typography, spacing, shadow, icon } =
    useMeanboxTheme();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ gadget?: string; q?: string }>();
  const seededIntent = isQuickGadgetIntent(String(params.gadget || ""))
    ? (String(params.gadget) as QuickGadgetIntent)
    : "tip";
  const [active, setActive] = useState<QuickGadgetIntent>(seededIntent);
  const [input, setInput] = useState(
    String(params.q || "").trim() || exampleSeed(seededIntent),
  );
  const [result, setResult] = useState<GadgetResult | null>(
    resolveQuickGadget(String(params.q || "").trim() || exampleSeed(seededIntent), seededIntent),
  );
  const [structuring, setStructuring] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    const g = String(params.gadget || "");
    const q = String(params.q || "").trim();
    if (isQuickGadgetIntent(g)) {
      setActive(g);
      const text = q || exampleSeed(g);
      setInput(text);
      setResult(resolveQuickGadget(text, g));
    } else if (q) {
      setInput(q);
      setResult(resolveQuickGadget(q, active));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.gadget, params.q]);

  useEffect(() => {
    if (!timerRunning || timerLeft == null) return;
    if (timerLeft <= 0) {
      setTimerRunning(false);
      return;
    }
    const id = setTimeout(() => setTimerLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(id);
  }, [timerRunning, timerLeft]);

  const onChangeInput = useCallback(
    (text: string) => {
      setInput(text);
      setResult(resolveQuickGadget(text, active));
      setCopied(false);
    },
    [active],
  );

  const onSelectGadget = useCallback((id: QuickGadgetIntent) => {
    setActive(id);
    const text = exampleSeed(id);
    setInput(text);
    setResult(resolveQuickGadget(text, id));
    setCopied(false);
    setTimerRunning(false);
    setTimerLeft(null);
  }, []);

  const onCopy = useCallback(async () => {
    if (!result?.copyText) return;
    await Clipboard.setStringAsync(result.copyText);
    setCopied(true);
  }, [result]);

  const onStructure = useCallback(async () => {
    if (!result || result.intent !== "rtcfc") return;
    setStructuring(true);
    try {
      const res = await structureRtcfc({
        text: input,
        apiBase: settings.apiBase,
      });
      if (res.success && res.data) {
        setResult(
          gadgetFromRtcfc(
            {
              role: res.data.role ?? "",
              task: res.data.task ?? "",
              context: res.data.context ?? "",
              format: res.data.format ?? "",
              constraints: res.data.constraints ?? "",
            },
            input,
          ),
        );
      } else {
        setResult(rollRtcfcGadget(result.rtcfc));
      }
    } catch {
      setResult(rollRtcfcGadget(result.rtcfc));
    } finally {
      setStructuring(false);
    }
  }, [result, input, settings.apiBase]);

  const displayAmount = useMemo(() => {
    if (result?.intent === "timer" && timerLeft != null) {
      const m = Math.floor(timerLeft / 60);
      const s = timerLeft % 60;
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return result?.amount;
  }, [result, timerLeft]);

  return (
    <Screen>
      <ScreenHeader
        title="Tools"
        actionLabel="Search tools on Meanbox"
        action={
          <Search size={18} color={color.ink2} strokeWidth={icon.strokeWidth} />
        }
        onActionPress={() =>
          void Linking.openURL(meanboxHref("/gadgets", settings))
        }
      />

      <SectionLabel style={{ marginTop: 0 }}>Quick gadgets</SectionLabel>
      <View style={styles.chips}>
        {gadgets.map((g) => {
          const Icon = gadgetIcons[g.id];
          const selected = active === g.id;
          return (
            <Chip
              key={g.id}
              label={g.label}
              selected={selected}
              onPress={() => onSelectGadget(g.id)}
              icon={
                <Icon
                  size={14}
                  color={selected ? color.brand : color.ink2}
                  strokeWidth={icon.strokeWidth}
                />
              }
            />
          );
        })}
      </View>

      <TextInput
        accessibilityLabel="Gadget input"
        value={input}
        onChangeText={onChangeInput}
        placeholder={exampleSeed(active)}
        placeholderTextColor={color.mutedForeground}
        multiline={active === "rtcfc"}
        style={{
          borderWidth: 1,
          borderColor: color.border,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 14,
          color: color.foreground,
          fontSize: typography.scale.body.fontSize,
          minHeight: active === "rtcfc" ? 88 : spacing.touchMin,
          backgroundColor: color.card,
          textAlignVertical: "top",
        }}
      />

      {result ? (
        <View
          style={[
            styles.card,
            {
              backgroundColor: color.card,
              borderRadius: radius.xl,
              ...shadow.lift,
            },
          ]}
        >
          <View style={styles.cardHead}>
            <Text
              style={{
                color: color.mutedForeground,
                fontSize: typography.scale.caption.fontSize,
              }}
            >
              {result.title}
            </Text>
            {result.badge ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: color.brandSoft,
                    borderRadius: radius.pill,
                  },
                ]}
              >
                <Text
                  style={{
                    color: color.brand,
                    fontSize: typography.scale.micro.fontSize,
                    fontWeight: "600",
                  }}
                >
                  {result.badge}
                </Text>
              </View>
            ) : null}
          </View>
          {displayAmount ? (
            <Text
              style={{
                color: color.foreground,
                fontSize: 36,
                fontWeight: "700",
                marginTop: 8,
                marginBottom: 12,
              }}
            >
              {displayAmount}
            </Text>
          ) : null}
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: color.border,
              marginBottom: 12,
            }}
          />
          {result.rows.map((row) => (
            <View key={row.label} style={styles.kv}>
              <Text
                style={{
                  color: color.mutedForeground,
                  fontSize: typography.scale.body.fontSize,
                  fontWeight: row.bold ? "700" : "400",
                }}
              >
                {row.label}
              </Text>
              <Text
                style={{
                  color: color.foreground,
                  fontSize: typography.scale.body.fontSize,
                  fontWeight: row.bold ? "700" : "500",
                  flexShrink: 1,
                  textAlign: "right",
                  marginLeft: 12,
                }}
                numberOfLines={3}
              >
                {row.value}
              </Text>
            </View>
          ))}
          <View style={styles.acts}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void onCopy()}
              style={[
                styles.act,
                {
                  backgroundColor: color.brandSoft,
                  borderRadius: radius.pill,
                  minHeight: spacing.touchMin,
                },
              ]}
            >
              <Copy size={16} color={color.brand} strokeWidth={icon.strokeWidth} />
              <Text style={{ color: color.brand, fontWeight: "600" }}>
                {copied ? "Copied" : "Copy"}
              </Text>
            </Pressable>
            {result.intent === "rtcfc" ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const next = rollRtcfcGadget(result.rtcfc);
                    setResult(next);
                    setInput(next.copyText);
                  }}
                  style={[
                    styles.act,
                    {
                      backgroundColor: color.muted,
                      borderRadius: radius.pill,
                      minHeight: spacing.touchMin,
                    },
                  ]}
                >
                  <Sparkles
                    size={16}
                    color={color.ink2}
                    strokeWidth={icon.strokeWidth}
                  />
                  <Text style={{ color: color.foreground, fontWeight: "600" }}>
                    Roll
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={structuring}
                  onPress={() => void onStructure()}
                  style={[
                    styles.act,
                    {
                      backgroundColor: color.muted,
                      borderRadius: radius.pill,
                      minHeight: spacing.touchMin,
                      opacity: structuring ? 0.7 : 1,
                    },
                  ]}
                >
                  {structuring ? (
                    <ActivityIndicator color={color.ink2} />
                  ) : (
                    <>
                      <Frame
                        size={16}
                        color={color.ink2}
                        strokeWidth={icon.strokeWidth}
                      />
                      <Text style={{ color: color.foreground, fontWeight: "600" }}>
                        Structure
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : result.intent === "timer" && result.timerSeconds ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (timerRunning) {
                    setTimerRunning(false);
                  } else {
                    setTimerLeft(timerLeft ?? result.timerSeconds ?? 0);
                    setTimerRunning(true);
                  }
                }}
                style={[
                  styles.act,
                  {
                    backgroundColor: color.muted,
                    borderRadius: radius.pill,
                    minHeight: spacing.touchMin,
                  },
                ]}
              >
                <Timer
                  size={16}
                  color={color.ink2}
                  strokeWidth={icon.strokeWidth}
                />
                <Text style={{ color: color.foreground, fontWeight: "600" }}>
                  {timerRunning ? "Pause" : timerLeft != null ? "Resume" : "Start"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => onSelectGadget(active)}
                style={[
                  styles.act,
                  {
                    backgroundColor: color.muted,
                    borderRadius: radius.pill,
                    minHeight: spacing.touchMin,
                  },
                ]}
              >
                <Text style={{ color: color.foreground, fontWeight: "600" }}>
                  Reset
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      <SectionLabel>Places nearby</SectionLabel>
      <ListRow
        title="Scan a menu or sign"
        meta="Open Places on Meanbox"
        card
        bordered={false}
        onPress={() =>
          void Linking.openURL(meanboxHref("/places", settings))
        }
        leading={
          <IconTile tone="brand">
            <Camera
              size={18}
              color={color.brand}
              strokeWidth={icon.strokeWidth}
            />
          </IconTile>
        }
      />
      <ListRow
        title="Add a quick note"
        meta="Save to your Meanbox"
        card
        bordered={false}
        onPress={() => void Linking.openURL(meanboxHref("/", settings))}
        leading={
          <IconTile tone="brand">
            <Plus
              size={18}
              color={color.brand}
              strokeWidth={icon.strokeWidth}
            />
          </IconTile>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  card: { padding: 20 },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4 },
  kv: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  acts: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  act: {
    flexGrow: 1,
    flexBasis: "40%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
});
