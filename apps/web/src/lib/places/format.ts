/**
 * Collapse provider open-state strings like "Open ⋅ Closes 10 PM" to "Open" / "Closed".
 * Leaves unrecognized strings unchanged.
 */
export function shortenOpenState(openState: string | undefined | null): string | undefined {
  if (openState == null) return undefined;
  const trimmed = openState.trim();
  if (!trimmed) return undefined;
  if (/^open\b/i.test(trimmed)) return "Open";
  if (/^closed\b/i.test(trimmed)) return "Closed";
  return trimmed;
}
