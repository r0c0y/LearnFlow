/**
 * Lazy Turso/SQLite client using a Proxy.
 *
 * ESM imports resolve BEFORE any module-level code runs.
 * Using a Proxy means createClient() is called on the FIRST property
 * access (e.g. db.execute(...)), by which time Node has fully loaded
 * the --env-file env vars and any dotenv.config() in server.js.
 */
import { createClient } from "@libsql/client";

let _client = null;

function getClient() {
  if (_client) return _client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  console.log('URL:',url)
  console.log(authToken)


  if (!url || url === "undefined" || url.trim() === "") {
    console.warn(
      "⚠️  TURSO_DATABASE_URL not set — using local SQLite file (learnflow.db). " +
      "Add your Turso credentials to learnflow/.env for cloud persistence."
    );
    _client = createClient({ url: "file:learnflow.db" });
  } else {
    console.log(`✅ Connecting to Turso: ${url.slice(0, 40)}...`);
    _client = createClient({ url, authToken });
  }

  return _client;
}

/**
 * db is a Proxy — any property access (execute, batch, etc.)
 * transparently delegates to the real client, created on first use.
 */
export const db = new Proxy({}, {
  get(_, prop) {
    const client = getClient();
    const val = client[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});
