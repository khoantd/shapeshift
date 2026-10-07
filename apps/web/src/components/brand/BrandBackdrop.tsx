type Props = {
  /** Public path under /brand/ */
  src: string;
  className?: string;
  /** Soft white wash so foreground text/UI stays readable */
  scrub?: "light" | "medium" | "heavy" | "none";
  position?: string;
};

const SCRIM: Record<NonNullable<Props["scrub"]>, string> = {
  none: "",
  light: "bg-background/40",
  medium: "bg-background/70",
  heavy: "bg-background/85",
};

/** Decorative full-bleed brand atmosphere layer (non-interactive). */
export function BrandBackdrop({
  src,
  className = "",
  scrub = "medium",
  position = "center",
}: Props) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{ backgroundImage: `url('${src}')`, backgroundPosition: position }}
      />
      {scrub !== "none" && <div className={`absolute inset-0 ${SCRIM[scrub]}`} />}
    </div>
  );
}
