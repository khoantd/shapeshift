export class Neo4jGraphError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "NEO4J_ERROR") {
    super(message);
    this.name = "Neo4jGraphError";
    this.status = status;
    this.code = code;
  }
}

const WRITE_PATTERN =
  /\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|LOAD\s+CSV|CALL\s*\{)\b/i;

export function assertReadOnlyCypher(cypher: string): void {
  const trimmed = cypher.trim();
  if (!trimmed) {
    throw new Neo4jGraphError("Cypher query is required", 400, "EMPTY_CYPHER");
  }
  if (WRITE_PATTERN.test(trimmed)) {
    throw new Neo4jGraphError(
      "Only read-only Cypher is allowed (MATCH / RETURN / WITH / …)",
      400,
      "WRITE_NOT_ALLOWED",
    );
  }
}
