/** Parses TextFlow proxy JSON (supports documented + litellm-aid-studio shapes). */
export function parseTextFlowTranscriptResponse(
  data: unknown,
): { text: string; language?: string } | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;

  if (root.success === true && typeof root.text === "string" && root.text.trim()) {
    return {
      text: root.text.trim(),
      ...(typeof root.language === "string" && root.language.trim()
        ? { language: root.language.trim() }
        : {}),
    };
  }

  const nested = root.data;
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>;
    const transcript = inner.transcript;
    if (typeof transcript === "string" && transcript.trim()) {
      return {
        text: transcript.trim(),
        ...(typeof inner.language === "string" && inner.language.trim()
          ? { language: inner.language.trim() }
          : {}),
      };
    }
  }

  if (typeof root.transcript === "string" && root.transcript.trim()) {
    return { text: root.transcript.trim() };
  }

  return null;
}
