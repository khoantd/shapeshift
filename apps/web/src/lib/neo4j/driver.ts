import neo4j, { type Driver, type Session } from "neo4j-driver";
import { loadNeo4jConfigFromEnv, type Neo4jConfig } from "./config";
import { assertReadOnlyCypher, Neo4jGraphError } from "./cypher-guard";
import { collectGraphFromRecords, type GraphPayload } from "./payload";

let sharedDriver: Driver | null = null;
let sharedConfigKey: string | null = null;

export function getNeo4jDriver(config: Neo4jConfig): Driver {
  const key = `${config.uri}|${config.username}|${config.database ?? ""}`;
  if (sharedDriver && sharedConfigKey === key) return sharedDriver;
  if (sharedDriver) {
    void sharedDriver.close().catch(() => undefined);
  }
  sharedDriver = neo4j.driver(
    config.uri,
    neo4j.auth.basic(config.username, config.password),
  );
  sharedConfigKey = key;
  return sharedDriver;
}

function openSession(config: Neo4jConfig): Session {
  const driver = getNeo4jDriver(config);
  return driver.session(
    config.database ? { database: config.database } : undefined,
  );
}

export type GraphQueryRunner = (
  cypher: string,
  params?: Record<string, unknown>,
) => Promise<GraphPayload>;

export function createNeo4jGraphRunner(config: Neo4jConfig): GraphQueryRunner {
  return async (cypher: string, params: Record<string, unknown> = {}) => {
    assertReadOnlyCypher(cypher);
    const session = openSession(config);
    try {
      const result = await session.executeRead((tx) => tx.run(cypher, params));
      return collectGraphFromRecords(
        result.records as Array<{
          keys: readonly PropertyKey[];
          get: (key: string) => unknown;
        }>,
      );
    } catch (error) {
      if (error instanceof Neo4jGraphError) throw error;
      const message =
        error instanceof Error ? error.message : "Neo4j query failed";
      throw new Neo4jGraphError(message, 502, "QUERY_FAILED");
    } finally {
      await session.close();
    }
  };
}

export async function runNeo4jWrite(
  config: Neo4jConfig,
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<void> {
  const session = openSession(config);
  try {
    await session.executeWrite((tx) => tx.run(cypher, params));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Neo4j write failed";
    throw new Neo4jGraphError(message, 502, "WRITE_FAILED");
  } finally {
    await session.close();
  }
}

export async function runNeo4jReadRecords(
  config: Neo4jConfig,
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<
  Array<{ get: (key: string) => unknown; keys: readonly PropertyKey[] }>
> {
  const session = openSession(config);
  try {
    const result = await session.executeRead((tx) => tx.run(cypher, params));
    return result.records as Array<{
      get: (key: string) => unknown;
      keys: readonly PropertyKey[];
    }>;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Neo4j query failed";
    throw new Neo4jGraphError(message, 502, "QUERY_FAILED");
  } finally {
    await session.close();
  }
}

export function requireNeo4jConfig(): Neo4jConfig {
  const config = loadNeo4jConfigFromEnv();
  if (!config) {
    throw new Neo4jGraphError(
      "Neo4j is not configured (set NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD)",
      503,
      "NEO4J_NOT_CONFIGURED",
    );
  }
  return config;
}
