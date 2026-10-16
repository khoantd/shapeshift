import { Image, type ImageStyle, type StyleProp } from "react-native";

type Variant = "mark" | "wordmark" | "lockup";

const SRC: Record<
  Variant,
  { source: number; aspectRatio: number; defaultHeight: number }
> = {
  // Intrinsic sizes match apps/web MeanboxLogo.
  mark: {
    source: require("../assets/brand/icon.png"),
    aspectRatio: 112 / 106,
    defaultHeight: 28,
  },
  wordmark: {
    source: require("../assets/brand/wordmark.png"),
    aspectRatio: 720 / 184,
    defaultHeight: 28,
  },
  lockup: {
    source: require("../assets/brand/lockup.png"),
    aspectRatio: 923 / 184,
    defaultHeight: 28,
  },
};

type Props = {
  variant?: Variant;
  /** Display height in dp; width follows intrinsic aspect ratio. */
  height?: number;
  style?: StyleProp<ImageStyle>;
};

/**
 * Meanbox brand assets (same PNGs as web `/brand/*`).
 */
export function MeanboxLogo({
  variant = "lockup",
  height,
  style,
}: Props) {
  const asset = SRC[variant];
  const h = height ?? asset.defaultHeight;
  return (
    <Image
      source={asset.source}
      accessibilityLabel="Meanbox"
      accessibilityRole="image"
      resizeMode="contain"
      style={[
        {
          height: h,
          width: h * asset.aspectRatio,
        },
        style,
      ]}
    />
  );
}
