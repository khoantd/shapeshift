import Image from "next/image";

type Variant = "mark" | "wordmark" | "lockup";

const SRC: Record<Variant, { src: string; width: number; height: number; alt: string }> = {
  mark: { src: "/brand/icon.png", width: 112, height: 106, alt: "Meanbox" },
  wordmark: { src: "/brand/wordmark.png", width: 720, height: 184, alt: "Meanbox" },
  lockup: { src: "/brand/lockup.png", width: 923, height: 184, alt: "Meanbox" },
};

type Props = {
  variant?: Variant;
  className?: string;
  priority?: boolean;
};

/**
 * Meanbox brand assets from the provided originals
 * (white-on-black lockup remapped to ink+teal for light UI).
 */
export function MeanboxLogo({ variant = "lockup", className, priority }: Props) {
  const asset = SRC[variant];
  return (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={asset.width}
      height={asset.height}
      priority={priority}
      className={className}
    />
  );
}
