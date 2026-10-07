export type Neo4jConfig = {
  uri: string;
  username: string;
  password: string;
  database?: string;
};

export function loadNeo4jConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Neo4jConfig | null {
  const uri = (env.NEO4J_URI?.trim() || env.NEO4J_DBMS?.trim() || "").replace(
    /\/$/,
    "",
  );
  const username = env.NEO4J_USERNAME?.trim() || env.NEO4J_USER?.trim() || "";
  const password = env.NEO4J_PASSWORD?.trim() || "";
  if (!uri || !username || !password) return null;

  const database = env.NEO4J_DATABASE?.trim() || undefined;
  return { uri, username, password, database };
}

export function isNeo4jConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return loadNeo4jConfigFromEnv(env) !== null;
}
