export type NewsPatchPin = { kind: "pin"; id: string; pinned: boolean };
export type NewsPatchRead = { kind: "read"; id: string; read: boolean };
export type NewsPatchBody = NewsPatchPin | NewsPatchRead;

/**
 * Parse PATCH /api/news body. Accepts either `{ id, pinned }` or `{ id, read }`.
 */
export function parseNewsPatchBody(raw: unknown): NewsPatchBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || id.length > 128) return null;

  const hasPinned = typeof body.pinned === "boolean";
  const hasRead = typeof body.read === "boolean";
  if (hasPinned === hasRead) return null; // need exactly one mutation field

  if (hasPinned) return { kind: "pin", id, pinned: body.pinned as boolean };
  return { kind: "read", id, read: body.read as boolean };
}
