/**
 * Detect Convex errors where a retry without optional newer fields
 * (`contentType`, `graphPayload`) is likely to succeed — e.g. deployment
 * still running an older mutation/schema, or document size limits on graph.
 */
export function shouldRetryLearningPackSaveWithoutExtras(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("argumentvalidationerror") ||
    m.includes("extra field") ||
    m.includes("does not match the validator") ||
    m.includes("does not match schema") ||
    m.includes("documentdoesnotmatchschema") ||
    m.includes("value is too large") ||
    m.includes("too big") ||
    m.includes("too large")
  );
}
