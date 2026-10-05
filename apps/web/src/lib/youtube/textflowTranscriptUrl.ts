/** Resolves proxy URL whether TEXTFLOW_API_URL is the host or includes `/api`. */
export function textFlowTranscriptProxyUrl(base: string): string {
  const trimmed = base.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/api")
    ? `${trimmed}/videos/transcript/proxy`
    : `${trimmed}/api/videos/transcript/proxy`;
}
