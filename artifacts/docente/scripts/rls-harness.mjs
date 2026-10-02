import pg from "pg";

// Never accept the app's DATABASE_URL here: this probe owns an ephemeral CI database.
const url = process.env.EPHEMERAL_DATABASE_URL;
if (!url) throw new Error("EPHEMERAL_DATABASE_URL is required; use an empty disposable CI database, not Supabase.");
const target = new URL(url);
if (target.pathname !== "/docente_ci" || !["localhost", "127.0.0.1"].includes(target.hostname)) {
  throw new Error("Refusing a database that is not the local disposable docente_ci database");
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(`
    CREATE ROLE foundation_probe NOLOGIN;
    CREATE SCHEMA foundation_probe;
    CREATE TABLE foundation_probe.items (owner_id text NOT NULL, value text NOT NULL);
    ALTER TABLE foundation_probe.items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE foundation_probe.items FORCE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA foundation_probe TO foundation_probe;
    GRANT SELECT, INSERT, UPDATE, DELETE ON foundation_probe.items TO foundation_probe;
    CREATE POLICY owner_only ON foundation_probe.items
      USING (owner_id = current_setting('app.actor', true))
      WITH CHECK (owner_id = current_setting('app.actor', true));
    INSERT INTO foundation_probe.items VALUES ('a', 'own'), ('b', 'other');
    SET LOCAL ROLE foundation_probe;
    SET LOCAL app.actor = 'a';
  `);
  const visible = await client.query("SELECT * FROM foundation_probe.items");
  if (visible.rows.length !== 1 || visible.rows[0].owner_id !== "a") throw new Error("RLS SELECT isolation failed");
  const updated = await client.query("UPDATE foundation_probe.items SET value='changed' WHERE owner_id='b'");
  const deleted = await client.query("DELETE FROM foundation_probe.items WHERE owner_id='b'");
  if (updated.rowCount || deleted.rowCount) throw new Error("RLS mutation isolation failed");
  await client.query("SAVEPOINT denied_insert");
  let denied = false;
  try {
    await client.query("INSERT INTO foundation_probe.items VALUES ('b','forbidden')");
  } catch (error) {
    if (error.code !== "42501") throw error;
    denied = true;
  }
  await client.query("ROLLBACK TO SAVEPOINT denied_insert");
  if (!denied) throw new Error("RLS INSERT should fail");
  process.stdout.write("PASS: ephemeral SQL/RLS harness (SELECT/INSERT/UPDATE/DELETE). Not product RLS.\n");
} finally {
  await client.query("ROLLBACK");
  await client.end();
}