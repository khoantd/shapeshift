/** Extract JSON text from a model reply (raw or ```json fenced). */
export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  return trimmed;
}

/** Parse a JSON object from a model reply; null on failure. */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  const jsonText = extractJsonText(raw);
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
