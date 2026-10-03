import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Never accept the app's DATABASE_URL here: this probe owns an ephemeral CI database.
const url = process.env.EPHEMERAL_DATABASE_URL;
if (!url) throw new Error("EPHEMERAL_DATABASE_URL is required; use an empty disposable CI database, not Supabase.");
const target = new URL(url);
if (target.pathname !== "/docente_ci" || !["localhost", "127.0.0.1"].includes(target.hostname)) {
  throw new Error("Refusing a database that is not the local disposable docente_ci database");
}

const here = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(here, "../../../supabase");
const matrix = JSON.parse(readFileSync(join(here, "../src/core/auth/permission-matrix.json"), "utf8"));

const client = new pg.Client({ connectionString: url });
await client.connect();
const q = (sql, params) => client.query(sql, params);

const results = [];
let failed = 0;

async function test(name, fn) {
  await q("SAVEPOINT t");
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (error) {
    failed++;
    results.push(`FAIL  ${name}\n      ${error.message}`);
  } finally {
    await q("ROLLBACK TO SAVEPOINT t");
    await q("SET CONSTRAINTS ALL DEFERRED");
    await q("RESET ROLE");
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Runs a statement expected to fail with the given SQLSTATE, keeping the transaction usable.
// SET CONSTRAINTS survives ROLLBACK TO SAVEPOINT, so restore the default deferred mode.
async function expectError(sql, params, code = "42501") {
  await q("SAVEPOINT e");
  try {
    await q(sql, params);
  } catch (error) {
    await q("ROLLBACK TO SAVEPOINT e");
    await q("SET CONSTRAINTS ALL DEFERRED");
    if (error.code !== code) throw new Error(`Expected ${code}, got ${error.code}: ${error.message}`);
    return;
  }
  await q("RELEASE SAVEPOINT e");
  throw new Error(`Expected ${code} but statement succeeded: ${sql}`);
}

// Deferred constraint triggers fire at commit; the harness never commits, so force them.
const checkDeferred = () => q("SET CONSTRAINTS ALL IMMEDIATE");

const now = () => Math.floor(Date.now() / 1000);
async function as(userId, { aal = "aal1", authAgeSeconds = 60 } = {}) {
  const claims = { sub: userId, role: "authenticated", aal, amr: [{ method: "password", timestamp: now() - authAgeSeconds }] };
  await q("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  await q("SET LOCAL ROLE authenticated");
}
async function asAnon() {
  await q("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
  await q("SET LOCAL ROLE anon");
}
const count = async (sql, params) => (await q(sql, params)).rowCount;

try {
  await q("BEGIN");

  // --- Foundation probe (etapa 1): the runner enforces RLS for a limited role. ---
  await test("foundation: limited role is isolated by RLS", async () => {
    await q(`
      CREATE ROLE foundation_probe NOLOGIN;
      CREATE SCHEMA foundation_probe;
      CREATE TABLE foundation_probe.items (owner_id text NOT NULL, value text NOT NULL);
      ALTER TABLE foundation_probe.items ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA foundation_probe TO foundation_probe;
      GRANT SELECT, INSERT, UPDATE, DELETE ON foundation_probe.items TO foundation_probe;
      CREATE POLICY owner_only ON foundation_probe.items
        USING (owner_id = current_setting('app.actor', true))
        WITH CHECK (owner_id = current_setting('app.actor', true));
      INSERT INTO foundation_probe.items VALUES ('a', 'own'), ('b', 'other');
      SET LOCAL ROLE foundation_probe;
      SET LOCAL app.actor = 'a';
    `);
    assert((await q("SELECT * FROM foundation_probe.items")).rowCount === 1, "SELECT isolation failed");
    assert(!(await count("UPDATE foundation_probe.items SET value='x' WHERE owner_id='b'")), "UPDATE isolation failed");
    assert(!(await count("DELETE FROM foundation_probe.items WHERE owner_id='b'")), "DELETE isolation failed");
    await expectError("INSERT INTO foundation_probe.items VALUES ('b','forbidden')");
  });

  // --- Product schema: Supabase emulation, migrations in order and dev seed. ---
  await q(readFileSync(join(supabaseDir, "tests/supabase-shim.sql"), "utf8"));
  for (const file of readdirSync(join(supabaseDir, "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    await q(readFileSync(join(supabaseDir, "migrations", file), "utf8"));
  }
  await q(readFileSync(join(supabaseDir, "seed.sql"), "utf8"));

  // Fixtures, created as the owner exactly as Supabase Auth would insert users.
  const ids = {};
  for (const name of ["a", "b", "director", "removed", "admin", "superadmin", "suspended", "unconfirmed"]) {
    const confirmed = name === "unconfirmed" ? null : new Date();
    const { rows } = await q("INSERT INTO auth.users (email, email_confirmed_at) VALUES ($1, $2) RETURNING id", [`${name}@example.test`, confirmed]);
    ids[name] = rows[0].id;
  }
  const orgA = (await q("INSERT INTO organizations (name, country_code) VALUES ('Org A', 'PE') RETURNING id")).rows[0].id;
  const orgB = (await q("INSERT INTO organizations (name, country_code) VALUES ('Org B', 'PE') RETURNING id")).rows[0].id;
  await q("INSERT INTO memberships (user_id, organization_id, role_code) VALUES ($1, $2, 'docente'), ($3, $2, 'director'), ($4, $5, 'docente')", [ids.a, orgA, ids.director, ids.b, orgB]);
  await q("INSERT INTO memberships (user_id, organization_id, role_code, status, removed_at) VALUES ($1, $2, 'docente', 'removed', now())", [ids.removed, orgA]);
  await q("INSERT INTO user_roles (user_id, role_code) VALUES ($1, 'admin'), ($2, 'superadmin')", [ids.admin, ids.superadmin]);
  await q("UPDATE users SET status = 'suspended' WHERE id = $1", [ids.suspended]);
  const catalog = Object.fromEntries((await q("SELECT code, id FROM education_catalog")).rows.map((r) => [r.code, r.id]));
  const territory = Object.fromEntries((await q("SELECT official_code, id FROM territory_units")).rows.map((r) => [r.official_code, r.id]));

  await test("matrix: SQL permission matrix matches permission-matrix.json", async () => {
    const { rows } = await q("SELECT role_code, permission FROM app_private.permission_matrix()");
    const sql = rows.map((r) => `${r.role_code}:${r.permission}`).sort();
    const json = Object.entries(matrix).flatMap(([role, perms]) => perms.map((p) => `${role}:${p}`)).sort();
    assert(JSON.stringify(sql) === JSON.stringify(json), `SQL ${sql} != JSON ${json}`);
    const roles = (await q("SELECT code FROM roles ORDER BY code")).rows.map((r) => r.code);
    assert(JSON.stringify(roles) === JSON.stringify(Object.keys(matrix).sort()), "Roles differ from matrix keys");
  });

  await test("signup: Auth user gets User, Profile, personal workspace and docente role", async () => {
    assert(await count("SELECT 1 FROM users WHERE id = $1 AND status = 'active'", [ids.a]) === 1, "user missing");
    assert(await count("SELECT 1 FROM profiles WHERE user_id = $1 AND onboarding_step = 1", [ids.a]) === 1, "profile missing");
    assert(await count("SELECT 1 FROM workspaces WHERE owner_user_id = $1 AND kind = 'personal'", [ids.a]) === 1, "workspace missing");
    assert(await count("SELECT 1 FROM user_roles WHERE user_id = $1 AND role_code = 'docente'", [ids.a]) === 1, "role missing");
  });

  await test("anon: no access to any product table or RPC", async () => {
    await asAnon();
    for (const table of ["users", "profiles", "countries", "territory_units", "education_catalog", "organizations", "workspaces", "memberships", "user_roles", "consent_records", "audit_logs"]) {
      await expectError(`SELECT 1 FROM public.${table}`);
    }
    await expectError("SELECT public.request_account_deletion()");
  });

  await test("user A/B: own profile only; no insert/delete; B invisible and immutable", async () => {
    await as(ids.a);
    assert(await count("SELECT 1 FROM profiles") === 1, "A should see exactly one profile");
    assert(await count("SELECT 1 FROM profiles WHERE user_id = $1", [ids.b]) === 0, "A sees B");
    assert(await count("UPDATE profiles SET display_name = 'x' WHERE user_id = $1", [ids.b]) === 0, "A updated B");
    assert(await count("UPDATE profiles SET display_name = 'Ana' WHERE user_id = $1", [ids.a]) === 1, "A cannot update self");
    await expectError("INSERT INTO profiles (user_id) VALUES (gen_random_uuid())");
    await expectError("DELETE FROM profiles WHERE user_id = $1", [ids.a]);
    await expectError("UPDATE profiles SET future_modular_code = '123' WHERE user_id = $1", [ids.a]);
    await expectError("UPDATE profiles SET user_id = $2 WHERE user_id = $1", [ids.a, ids.b]);
  });

  await test("user A/B: education selections and consent are private", async () => {
    await as(ids.a);
    await expectError("INSERT INTO profile_education_selections (user_id, catalog_id) VALUES ($1, $2)", [ids.b, catalog.primaria]);
    await expectError("INSERT INTO consent_records (user_id, document, version) VALUES ($1, 'terminos', 'v')", [ids.b]);
    await q("INSERT INTO consent_records (user_id, document, version) VALUES ($1, 'terminos', 'v')", [ids.a]);
    await expectError("INSERT INTO consent_records (user_id, document, version, accepted_at) VALUES ($1, 'terminos', 'v', now() - interval '1 year')", [ids.a]);
    await expectError("UPDATE consent_records SET version = 'w' WHERE user_id = $1", [ids.a]);
    await expectError("DELETE FROM consent_records WHERE user_id = $1", [ids.a]);
    await as(ids.b);
    assert(await count("SELECT 1 FROM consent_records") === 0, "B sees A consent");
  });

  await test("users table: own status readable, never writable", async () => {
    await as(ids.a);
    assert(await count("SELECT 1 FROM users") === 1, "A should see only self");
    await expectError("UPDATE users SET status = 'active' WHERE id = $1", [ids.a]);
    await expectError("DELETE FROM users WHERE id = $1", [ids.a]);
  });

  await test("self-elevation: no role insert, update or delete from the client", async () => {
    await as(ids.a);
    await expectError("INSERT INTO user_roles (user_id, role_code) VALUES ($1, 'superadmin')", [ids.a]);
    await expectError("UPDATE user_roles SET role_code = 'admin' WHERE user_id = $1", [ids.a]);
    await expectError("DELETE FROM user_roles WHERE user_id = $1", [ids.a]);
    await expectError("SELECT public.admin_grant_role($1, 'admin')", [ids.a]);
    await expectError("SELECT app_private.bootstrap_superadmin($1)", [ids.a]);
    await expectError("INSERT INTO memberships (user_id, organization_id, role_code) VALUES ($1, $2, 'director')", [ids.a, orgB]);
  });

  await test("audit log: no client access; append-only even for the owner", async () => {
    await as(ids.admin, { aal: "aal2" });
    await expectError("SELECT 1 FROM audit_logs");
    await expectError("INSERT INTO audit_logs (actor_context, action, resource_type, result) VALUES ('user', 'x', 'y', 'success')");
    await q("RESET ROLE");
    await q("INSERT INTO audit_logs (actor_context, action, resource_type, result) VALUES ('system', 'test.entry', 'test', 'success')");
    await expectError("UPDATE audit_logs SET result = 'error'");
    await expectError("DELETE FROM audit_logs");
  });

  await test("suspension: valid token sees and changes nothing, but can read own status", async () => {
    await as(ids.suspended);
    assert(await count("SELECT 1 FROM profiles") === 0, "suspended reads profile");
    assert(await count("UPDATE profiles SET display_name = 'x'") === 0, "suspended updated profile");
    await expectError("INSERT INTO profile_education_selections (user_id, catalog_id) VALUES ($1, $2)", [ids.suspended, catalog.primaria]);
    assert(await count("SELECT 1 FROM workspaces") === 0, "suspended reads workspace");
    assert(await count("SELECT 1 FROM users WHERE status = 'suspended'") === 1, "suspended cannot read own status");
  });

  await test("organizations A/B: members see only their org and workspace", async () => {
    await as(ids.a);
    const orgs = (await q("SELECT id FROM organizations")).rows.map((r) => r.id);
    assert(orgs.length === 1 && orgs[0] === orgA, "A org visibility wrong");
    assert(await count("SELECT 1 FROM workspaces WHERE organization_id = $1", [orgA]) === 1, "A cannot see org A workspace");
    assert(await count("SELECT 1 FROM workspaces WHERE organization_id = $1", [orgB]) === 0, "A sees org B workspace");
    assert(await count("SELECT 1 FROM workspaces WHERE owner_user_id = $1", [ids.b]) === 0, "A sees B personal workspace");
    assert(await count("SELECT 1 FROM memberships") === 1, "docente should see only own membership");
    await expectError("UPDATE organizations SET name = 'x'");
    await expectError("INSERT INTO organizations (name, country_code) VALUES ('x', 'PE')");
  });

  await test("organizations: director reads members of own org only", async () => {
    await as(ids.director);
    assert(await count("SELECT 1 FROM memberships WHERE organization_id = $1", [orgA]) === 3, "director should see 3 org A memberships");
    assert(await count("SELECT 1 FROM memberships WHERE organization_id = $1", [orgB]) === 0, "director sees org B");
  });

  await test("removed member: loses organization and workspace access", async () => {
    await as(ids.removed);
    assert(await count("SELECT 1 FROM organizations") === 0, "removed member sees org");
    assert(await count("SELECT 1 FROM workspaces WHERE kind = 'institutional'") === 0, "removed member sees workspace");
  });

  await test("inactive organization: no access for active members", async () => {
    await q("UPDATE organizations SET status = 'inactive' WHERE id = $1", [orgA]);
    await as(ids.a);
    assert(await count("SELECT 1 FROM organizations") === 0, "inactive org visible");
  });

  await test("workspace: owner cannot be changed, not even by the table owner", async () => {
    await as(ids.a);
    await expectError("UPDATE workspaces SET owner_user_id = $1", [ids.a]);
    await q("RESET ROLE");
    await expectError("UPDATE workspaces SET owner_user_id = $1 WHERE owner_user_id = $2", [ids.b, ids.a], "23514");
    await expectError("INSERT INTO workspaces (kind, owner_user_id) VALUES ('personal', $1)", [ids.a], "23505");
    await expectError("INSERT INTO workspaces (kind, owner_user_id, organization_id) VALUES ('personal', $1, $2)", [ids.unconfirmed, orgB], "23514");
  });

  await test("onboarding: completion requires name, country and a level", async () => {
    await as(ids.a);
    await q("UPDATE profiles SET display_name = 'Ana', country_code = 'PE', onboarding_completed_at = now()");
    await expectError("SET CONSTRAINTS ALL IMMEDIATE", [], "23514");
  });

  await test("onboarding: valid profile with region, UGEL, level and grade completes", async () => {
    await as(ids.a);
    await q("UPDATE profiles SET display_name = 'Ana', country_code = 'PE', region_id = $1, ugel_id = $2, institution_name = 'IE de prueba', onboarding_step = 3, onboarding_completed_at = now()", [territory["SIN-R01"], territory["SIN-U01"]]);
    await q("INSERT INTO profile_education_selections (user_id, catalog_id) VALUES ($1, $2), ($1, $3)", [ids.a, catalog.primaria, catalog["primaria-2"]]);
    await checkDeferred();
  });

  await test("onboarding: incoherent territory and catalog are rejected", async () => {
    await as(ids.a);
    await q("UPDATE profiles SET country_code = 'PE', region_id = $1, ugel_id = $2", [territory["SIN-R01"], territory["SIN-U03"]]);
    await expectError("SET CONSTRAINTS ALL IMMEDIATE", [], "23514");
    await q("UPDATE profiles SET country_code = 'PE', region_id = $1, ugel_id = null", [territory["SIN-U01"]]);
    await expectError("SET CONSTRAINTS ALL IMMEDIATE", [], "23514");
    await q("UPDATE profiles SET country_code = 'PE', region_id = null");
    await q("INSERT INTO profile_education_selections (user_id, catalog_id) VALUES ($1, $2), ($1, $3)", [ids.a, catalog.primaria, catalog["secundaria-1"]]);
    await expectError("SET CONSTRAINTS ALL IMMEDIATE", [], "23514");
  });

  await test("onboarding RPC: replaces own selections atomically and completes", async () => {
    await as(ids.a);
    await q("UPDATE profiles SET display_name = 'Ana', country_code = 'PE'");
    await expectError("SELECT public.save_education_selection($1, true)", [[]], "23514");
    await expectError("SELECT public.save_education_selection($1, false)", [[catalog["primaria-1"]]], "23514");
    // Each RPC is its own transaction in Supabase; restore deferred mode between calls.
    await q("SELECT public.save_education_selection($1, true)", [[catalog.primaria, catalog["primaria-1"]]]);
    await q("SET CONSTRAINTS ALL DEFERRED");
    await q("SELECT public.save_education_selection($1, false)", [[catalog.secundaria]]);
    const { rows } = await q("SELECT catalog_id FROM profile_education_selections");
    assert(rows.length === 1 && rows[0].catalog_id === catalog.secundaria, "selection not replaced");
    assert(await count("SELECT 1 FROM profiles WHERE onboarding_completed_at IS NOT NULL") === 1, "not completed");
    await expectError("SELECT public.save_education_selection($1, false)", [[]], "23514");
    await as(ids.suspended);
    await expectError("SELECT public.save_education_selection($1, false)", [[catalog.primaria]]);
    await asAnon();
    await expectError("SELECT public.save_education_selection($1, false)", [[catalog.primaria]]);
  });

  await test("onboarding: a step can be saved incomplete and resumed", async () => {
    await as(ids.a);
    await q("UPDATE profiles SET display_name = 'Ana', onboarding_step = 2");
    await checkDeferred();
    const { rows } = await q("SELECT onboarding_step, onboarding_completed_at FROM profiles");
    assert(rows[0].onboarding_step === 2 && rows[0].onboarding_completed_at === null, "step not persisted");
  });

  await test("roles: creador/revisor are never assignable; director is institutional only", async () => {
    await expectError("INSERT INTO user_roles (user_id, role_code) VALUES ($1, 'creador')", [ids.a], "23514");
    await expectError("INSERT INTO user_roles (user_id, role_code) VALUES ($1, 'director')", [ids.a], "23514");
    await expectError("INSERT INTO memberships (user_id, organization_id, role_code) VALUES ($1, $2, 'admin')", [ids.b, orgA], "23514");
    await expectError("INSERT INTO user_roles (user_id, role_code, granted_by) VALUES ($1, 'admin', $1)", [ids.a], "23514");
  });

  await test("admin without MFA cannot run administrative actions", async () => {
    await as(ids.admin, { aal: "aal1" });
    await expectError("SELECT public.admin_set_user_status($1, 'suspended')", [ids.a]);
    await expectError("SELECT public.admin_grant_role($1, 'docente')", [ids.b]);
  });

  await test("admin with MFA: suspends docente (audited), cannot grant admin roles", async () => {
    await as(ids.admin, { aal: "aal2" });
    await q("SELECT public.admin_set_user_status($1, 'suspended')", [ids.a]);
    await expectError("SELECT public.admin_grant_role($1, 'admin')", [ids.b]);
    await expectError("SELECT public.admin_grant_role($1, 'creador')", [ids.b], "23514");
    await expectError("SELECT public.admin_set_user_status($1, 'suspended')", [ids.superadmin]);
    await expectError("SELECT public.admin_set_user_status($1, 'suspended')", [ids.admin]);
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM users WHERE id = $1 AND status = 'suspended'", [ids.a]) === 1, "not suspended");
    assert(await count("SELECT 1 FROM audit_logs WHERE action = 'user.status_changed' AND actor_user_id = $1 AND resource_id = $2", [ids.admin, ids.a]) === 1, "not audited");
  });

  await test("non-admin with MFA session still cannot administer", async () => {
    await as(ids.b, { aal: "aal2" });
    await expectError("SELECT public.admin_set_user_status($1, 'suspended')", [ids.a]);
  });

  await test("suspended admin cannot administer", async () => {
    await q("UPDATE users SET status = 'suspended' WHERE id = $1", [ids.admin]);
    await as(ids.admin, { aal: "aal2" });
    await expectError("SELECT public.admin_set_user_status($1, 'suspended')", [ids.a]);
  });

  await test("superadmin with MFA grants admin; last superadmin cannot be removed", async () => {
    await as(ids.superadmin, { aal: "aal2" });
    await q("SELECT public.admin_grant_role($1, 'admin')", [ids.b]);
    await expectError("SELECT public.admin_revoke_role($1, 'superadmin')", [ids.superadmin], "23514");
    await q("RESET ROLE");
    await expectError("DELETE FROM user_roles WHERE role_code = 'superadmin'", [], "23514");
  });

  await test("bootstrap: requires confirmed email and no existing superadmin", async () => {
    await expectError("SELECT app_private.bootstrap_superadmin($1)", [ids.b], "23514");
    await q("ALTER TABLE user_roles DISABLE TRIGGER user_roles_last_superadmin");
    await q("DELETE FROM user_roles WHERE role_code = 'superadmin'");
    await q("ALTER TABLE user_roles ENABLE TRIGGER user_roles_last_superadmin");
    await expectError("SELECT app_private.bootstrap_superadmin($1)", [ids.unconfirmed], "23514");
    await q("SELECT app_private.bootstrap_superadmin($1)", [ids.b]);
    assert(await count("SELECT 1 FROM user_roles WHERE user_id = $1 AND role_code = 'superadmin' AND granted_by IS NULL", [ids.b]) === 1, "not bootstrapped");
  });

  await test("deletion: requires recent authentication", async () => {
    await as(ids.b, { authAgeSeconds: 3600 });
    await expectError("SELECT public.request_account_deletion()");
    await expectError("SELECT public.perform_account_deletion()");
  });

  await test("deletion: blocks access, erases own data, keeps shared org, is idempotent", async () => {
    await q("INSERT INTO consent_records (user_id, document, version) VALUES ($1, 'privacidad', 'v')", [ids.b]);
    await as(ids.b);
    await q("SELECT public.request_account_deletion()");
    assert(await count("SELECT 1 FROM profiles") === 0, "pending deletion still reads profile");
    await expectError("SELECT public.request_account_deletion()");
    await q("SELECT public.perform_account_deletion()");
    await q("SELECT public.perform_account_deletion()");
    await q("RESET ROLE");
    await checkDeferred();
    for (const table of ["users", "profiles", "consent_records", "memberships", "user_roles"]) {
      const column = table === "users" ? "id" : "user_id";
      assert(await count(`SELECT 1 FROM ${table} WHERE ${column} = $1`, [ids.b]) === 0, `${table} not erased`);
    }
    assert(await count("SELECT 1 FROM auth.users WHERE id = $1", [ids.b]) === 0, "Auth identity remains");
    assert(await count("SELECT 1 FROM organizations WHERE id = $1", [orgB]) === 1, "shared org deleted");
    assert(await count("SELECT 1 FROM audit_logs WHERE action = 'account.deleted' AND resource_id = $1", [ids.b]) === 1, "deletion not audited");
  });

  await test("deletion: a failure keeps the account blocked and a retry succeeds", async () => {
    await q("CREATE FUNCTION pg_temp.fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated Auth failure'; END $$");
    await q("CREATE TRIGGER simulated_failure BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION pg_temp.fail()");
    await as(ids.a);
    await q("SELECT public.request_account_deletion()");
    await expectError("SELECT public.perform_account_deletion()", [], "P0001");
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM users WHERE id = $1 AND status = 'deletion_pending'", [ids.a]) === 1, "not left pending");
    await q("DROP TRIGGER simulated_failure ON auth.users");
    await as(ids.a);
    await q("SELECT public.perform_account_deletion()");
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM auth.users WHERE id = $1", [ids.a]) === 0, "retry did not delete");
  });

  await test("deletion: last superadmin is blocked until a substitute exists", async () => {
    await as(ids.superadmin);
    await expectError("SELECT public.request_account_deletion()", [], "23514");
    await q("RESET ROLE");
    await q("INSERT INTO user_roles (user_id, role_code) VALUES ($1, 'superadmin')", [ids.director]);
    await as(ids.superadmin);
    await q("SELECT public.request_account_deletion()");
    await q("SELECT public.perform_account_deletion()");
  });

  // --- Etapa 3: módulos, interés, avisos, notificaciones y actividad. ---
  // Owner-only helpers: call them before switching role inside a test.
  const setCountry = (userId, code) => q("UPDATE profiles SET country_code = $2 WHERE user_id = $1", [userId, code]);
  const addTestCountry = () => q("INSERT INTO countries (code, name, currency, locale, time_zone) VALUES ('ZZ', 'País sintético', 'PEN', 'es-PE', 'America/Lima')");
  const myModules = async () => (await q("SELECT module_id, access, interested FROM public.list_my_modules()")).rows;
  const accessOf = (rows) => Object.fromEntries(rows.map((r) => [r.module_id, r.access]));
  const future = ["generador-ia", "biblioteca", "marketplace", "cursos-simulacros"];

  await test("modules: coming_soon listed, demo requires entitlement, hidden and unavailable country excluded", async () => {
    await setCountry(ids.a, "PE");
    await as(ids.a);
    let rows = await myModules();
    assert(JSON.stringify(rows.map((r) => r.module_id)) === JSON.stringify([...future, "demo"]), `unexpected modules ${rows.map((r) => r.module_id)}`);
    for (const id of future) assert(accessOf(rows)[id] === "coming_soon", `${id} not coming_soon`);
    assert(accessOf(rows).demo === "requires_entitlement", "demo must require entitlement");
    assert(rows.every((r) => r.interested === false), "no interest expected yet");
    assert(await count("SELECT 1 FROM entitlements WHERE code = 'demo.access'") === 1, "entitlement not readable");
    await expectError("UPDATE modules SET status = 'active'");
    await expectError("INSERT INTO module_availability (module_id, country_code) VALUES ('demo', 'PE')");
    await expectError("DELETE FROM entitlements");
    await q("RESET ROLE");
    await q("UPDATE modules SET status = 'hidden' WHERE id = 'biblioteca'");
    await q("UPDATE modules SET emergency_disabled = true WHERE id = 'generador-ia'");
    await as(ids.a);
    rows = await myModules();
    assert(!rows.some((r) => r.module_id === "biblioteca"), "hidden module listed");
    assert(await count("SELECT 1 FROM modules WHERE id = 'biblioteca'") === 0, "hidden module readable");
    assert(accessOf(rows)["generador-ia"] === "disabled", "emergency_disabled must be disabled");
    await q("RESET ROLE");
    await addTestCountry();
    await setCountry(ids.a, "ZZ");
    await as(ids.a);
    assert((await myModules()).length === 0, "modules listed for a country without availability");
    await as(ids.director); // profile without country
    assert((await myModules()).length === 0, "modules listed without profile country");
  });

  await test("modules: resolver order and entitlements stay closed until stage 5", async () => {
    await q("INSERT INTO modules (id, status, implementation_available, sort_order) VALUES ('prueba-activo', 'active', true, 60), ('prueba-sin-impl', 'active', false, 70)");
    await q("INSERT INTO module_availability (module_id, country_code) VALUES ('prueba-activo', 'PE'), ('prueba-sin-impl', 'PE')");
    await q("UPDATE modules SET emergency_disabled = true, status = 'coming_soon' WHERE id = 'marketplace'");
    assert((await q("SELECT app_private.has_entitlement('demo.access') AS v")).rows[0].v === false, "has_entitlement must be false");
    assert((await q("SELECT app_private.current_plan_code() AS v")).rows[0].v === "gratis", "plan must be gratis");
    await setCountry(ids.a, "PE");
    await as(ids.a);
    let access = accessOf(await myModules());
    assert(access["prueba-activo"] === "available", "active + implemented must be available");
    assert(access["prueba-sin-impl"] === "coming_soon", "active without implementation must be coming_soon");
    assert(access.marketplace === "disabled", "disabled must win over coming_soon");
    await expectError("SELECT public.register_module_interest('prueba-activo')");
    await expectError("SELECT public.register_module_interest('demo')");
    await expectError("SELECT public.register_module_interest('marketplace')");
    await expectError("SELECT public.register_module_interest('no-existe')");
    await q("RESET ROLE");
    await q("UPDATE modules SET implementation_available = false WHERE id = 'demo'");
    await as(ids.a);
    assert(accessOf(await myModules()).demo === "requires_entitlement", "entitlement check must precede implementation");
    await q("RESET ROLE");
    await q("UPDATE modules SET emergency_disabled = true WHERE id = 'demo'");
    await as(ids.a);
    access = accessOf(await myModules());
    assert(access.demo === "disabled", "disabled demo must be disabled");
    assert(!Object.values(access).includes("hidden"), "hidden must never be listed");
  });

  await test("interest: own, idempotent, withdrawable and recorded as activity", async () => {
    await setCountry(ids.a, "PE");
    await as(ids.a);
    await q("SELECT public.register_module_interest('biblioteca')");
    await q("SELECT public.register_module_interest('biblioteca')");
    const { rows } = await q("SELECT user_id, country_code FROM module_interests");
    assert(rows.length === 1 && rows[0].user_id === ids.a && rows[0].country_code === "PE", "interest not registered once with profile country");
    assert((await myModules()).find((r) => r.module_id === "biblioteca").interested === true, "interested flag missing");
    await q("SELECT public.withdraw_module_interest('biblioteca')");
    await q("SELECT public.withdraw_module_interest('biblioteca')");
    assert(await count("SELECT 1 FROM module_interests") === 0, "interest not withdrawn");
    await q("RESET ROLE");
    const kinds = (await q("SELECT kind FROM activity_events WHERE user_id = $1 AND module_id = 'biblioteca' ORDER BY id", [ids.a])).rows.map((r) => r.kind);
    assert(JSON.stringify(kinds) === JSON.stringify(["module.interest_added", "module.interest_removed"]), `activity ${kinds}`);
  });

  await test("interest: others' rows invisible and undeletable; direct insert only own and coming_soon", async () => {
    await setCountry(ids.a, "PE");
    await setCountry(ids.b, "PE");
    await as(ids.b);
    await q("SELECT public.register_module_interest('marketplace')");
    await as(ids.a);
    assert(await count("SELECT 1 FROM module_interests") === 0, "A sees B interest");
    assert(await count("DELETE FROM module_interests WHERE user_id = $1", [ids.b]) === 0, "A deleted B interest");
    await q("SELECT public.withdraw_module_interest('marketplace')");
    await expectError("INSERT INTO module_interests (user_id, module_id) VALUES ($1, 'biblioteca')", [ids.b]);
    await expectError("INSERT INTO module_interests (user_id, module_id) VALUES ($1, 'demo')", [ids.a]);
    await expectError("INSERT INTO module_interests (user_id, module_id, country_code) VALUES ($1, 'biblioteca', 'PE')", [ids.a]);
    await q("INSERT INTO module_interests (user_id, module_id) VALUES ($1, 'biblioteca')", [ids.a]);
    await expectError("UPDATE module_interests SET module_id = 'marketplace'");
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM module_interests WHERE user_id = $1 AND module_id = 'marketplace'", [ids.b]) === 1, "B interest lost");
    await q("UPDATE modules SET emergency_disabled = true WHERE id = 'cursos-simulacros'");
    await as(ids.a);
    await expectError("INSERT INTO module_interests (user_id, module_id) VALUES ($1, 'cursos-simulacros')", [ids.a]);
  });

  await test("suspended: no modules, interests, announcements, notifications or activity", async () => {
    await setCountry(ids.suspended, "PE");
    await q("INSERT INTO module_interests (user_id, module_id) VALUES ($1, 'biblioteca')", [ids.suspended]);
    await q("INSERT INTO notifications (user_id, kind, title, body, link_path, dedupe_key) VALUES ($1, 'welcome', 't', 'b', '/panel', 'welcome')", [ids.suspended]);
    await as(ids.suspended);
    assert((await myModules()).length === 0, "suspended lists modules");
    assert(await count("SELECT 1 FROM module_interests") === 0, "suspended reads interests");
    assert(await count("DELETE FROM module_interests") === 0, "suspended deletes interests");
    assert(await count("SELECT 1 FROM announcements") === 0, "suspended reads announcements");
    assert(await count("SELECT 1 FROM notifications") === 0, "suspended reads notifications");
    await expectError("SELECT public.register_module_interest('marketplace')");
    await expectError("SELECT public.withdraw_module_interest('biblioteca')");
    await expectError("SELECT public.mark_notifications_read()");
    await expectError("SELECT public.record_session_started()");
  });

  await test("anon: no access to stage-3 tables or RPCs", async () => {
    await asAnon();
    for (const table of ["modules", "entitlements", "module_availability", "module_interests", "announcements", "notifications", "activity_events"]) {
      await expectError(`SELECT 1 FROM public.${table}`);
    }
    for (const call of ["public.list_my_modules()", "public.register_module_interest('biblioteca')", "public.withdraw_module_interest('biblioteca')", "public.mark_notifications_read()", "public.record_session_started()", "app_private.module_access('biblioteca')"]) {
      await expectError(`SELECT ${call}`);
    }
  });

  await test("announcements: visible only when published, current and matching country, role and plan", async () => {
    await addTestCountry();
    await q(`INSERT INTO announcements (title, body, status, starts_at, ends_at, country_codes, role_codes, plan_codes) VALUES
      ('Visible PE', 'x', 'published', now() - interval '1 day', null, '{PE}', '{}', '{}'),
      ('Solo ZZ', 'x', 'published', now() - interval '1 day', null, '{ZZ}', '{}', '{}'),
      ('Solo admin', 'x', 'published', now() - interval '1 day', null, '{}', '{admin}', '{}'),
      ('Docente', 'x', 'published', now() - interval '1 day', null, '{}', '{docente}', '{}'),
      ('Plan gratis', 'x', 'published', now() - interval '1 day', null, '{}', '{}', '{gratis}'),
      ('Plan individual', 'x', 'published', now() - interval '1 day', null, '{}', '{}', '{individual,institucional}'),
      ('PE y admin', 'x', 'published', now() - interval '1 day', null, '{PE}', '{admin}', '{}'),
      ('Borrador', 'x', 'draft', now() - interval '1 day', null, '{}', '{}', '{}'),
      ('Vencido', 'x', 'published', now() - interval '2 days', now() - interval '1 day', '{}', '{}', '{}'),
      ('Futuro', 'x', 'published', now() + interval '1 day', null, '{}', '{}', '{}'),
      ('Vigente con fin', 'x', 'published', now() - interval '1 day', now() + interval '1 day', '{}', '{}', '{}')`);
    await setCountry(ids.a, "PE");
    const titles = async () => (await q("SELECT title FROM announcements ORDER BY title")).rows.map((r) => r.title).join("|");
    await as(ids.a);
    const forA = ["Aviso de prueba", "Docente", "Plan gratis", "Vigente con fin", "Visible PE"].sort().join("|");
    assert(await titles() === forA, `docente PE sees ${await titles()}`);
    await expectError("INSERT INTO announcements (title, body, status) VALUES ('x', 'y', 'published')");
    await expectError("UPDATE announcements SET status = 'draft'");
    await expectError("DELETE FROM announcements");
    await as(ids.admin); // roles docente + admin, profile without country
    const forAdmin = ["Aviso de prueba", "Docente", "Plan gratis", "Solo admin", "Vigente con fin"].sort().join("|");
    assert(await titles() === forAdmin, `admin without country sees ${await titles()}`);
    await q("RESET ROLE");
    await setCountry(ids.admin, "PE");
    await as(ids.admin);
    assert((await titles()).includes("PE y admin"), "AND of country and role not satisfied for admin PE");
  });

  await test("announcements: invalid audience, dates, status and text are rejected", async () => {
    const insert = (cols, vals) => `INSERT INTO announcements (title, body${cols}) VALUES ('t', 'b'${vals})`;
    await expectError(insert(", country_codes", ", '{XX}'"), [], "23514");
    await expectError(insert(", role_codes", ", '{inexistente}'"), [], "23514");
    await expectError(insert(", plan_codes", ", '{premium}'"), [], "23514");
    await expectError(insert(", starts_at, ends_at", ", now(), now()"), [], "23514");
    await expectError(insert(", status", ", 'archived'"), [], "23514");
    await expectError("INSERT INTO announcements (title, body) VALUES ('', 'b')", [], "23514");
    await expectError("INSERT INTO announcements (title, body) VALUES (E'a\\nb', 'b')", [], "23514");
    await expectError("INSERT INTO announcements (title, body) VALUES ('t', repeat('x', 2001))", [], "23514");
    await q(insert(", country_codes, role_codes, plan_codes", ", '{PE}', '{docente,director}', '{gratis}'"));
  });

  await test("notifications: private, read-only for the client; mark read affects only own", async () => {
    const add = async (user, key) => (await q("INSERT INTO notifications (user_id, kind, title, body, link_path, dedupe_key) VALUES ($1, 'module_available', 't', 'b', '/modulos/biblioteca', $2) RETURNING id", [user, key])).rows[0].id;
    const a1 = await add(ids.a, "k1");
    const a2 = await add(ids.a, "k2");
    const b1 = await add(ids.b, "k1");
    await expectError("INSERT INTO notifications (user_id, kind, title, body, link_path, dedupe_key) VALUES ($1, 'welcome', 't', 'b', '/panel', 'k1')", [ids.a], "23505");
    await expectError("INSERT INTO notifications (user_id, kind, title, body, link_path, dedupe_key) VALUES ($1, 'welcome', 't', 'b', '//evil.example', 'x')", [ids.a], "23514");
    await expectError("INSERT INTO notifications (user_id, kind, title, body, link_path, dedupe_key) VALUES ($1, 'welcome', 't', 'b', 'https://evil.example', 'y')", [ids.a], "23514");
    await as(ids.a);
    assert(await count("SELECT 1 FROM notifications") === 2, "A should see exactly own 2");
    await expectError("INSERT INTO notifications (user_id, kind, title, body, link_path, dedupe_key) VALUES ($1, 'welcome', 't', 'b', '/panel', 'z')", [ids.a]);
    await expectError("UPDATE notifications SET read_at = now()");
    await expectError("DELETE FROM notifications");
    await q("SELECT public.mark_notifications_read($1)", [[b1]]);
    await q("SELECT public.mark_notifications_read($1)", [[a1]]);
    let read = (await q("SELECT id FROM notifications WHERE read_at IS NOT NULL")).rows.map((r) => r.id);
    assert(read.length === 1 && read[0] === a1, "only a1 should be read");
    await q("SELECT public.mark_notifications_read()");
    assert(await count("SELECT 1 FROM notifications WHERE read_at IS NULL") === 0, "mark all failed");
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM notifications WHERE id = $1 AND read_at IS NULL", [b1]) === 1, "A marked B notification");
    assert(await count("SELECT 1 FROM notifications WHERE id = $1 AND read_at IS NOT NULL", [a2]) === 1, "a2 not marked");
  });

  await test("welcome: onboarding completion notifies once and records activity once", async () => {
    await as(ids.a);
    await q("UPDATE profiles SET display_name = 'Ana', country_code = 'PE'");
    await q("SELECT public.save_education_selection($1, true)", [[catalog.primaria]]);
    await q("SET CONSTRAINTS ALL DEFERRED");
    const { rows } = await q("SELECT kind, link_path, read_at FROM notifications");
    assert(rows.length === 1 && rows[0].kind === "welcome" && rows[0].link_path === "/panel" && rows[0].read_at === null, "welcome missing");
    await q("SELECT public.save_education_selection($1, true)", [[catalog.primaria]]);
    await q("SET CONSTRAINTS ALL DEFERRED");
    await q("UPDATE profiles SET onboarding_completed_at = null");
    await q("UPDATE profiles SET onboarding_completed_at = now()");
    await checkDeferred();
    assert(await count("SELECT 1 FROM notifications") === 1, "welcome duplicated");
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM activity_events WHERE user_id = $1 AND kind = 'onboarding.completed'", [ids.a]) === 1, "onboarding activity not recorded once");
    assert(await count("SELECT 1 FROM notifications WHERE user_id <> $1", [ids.a]) === 0, "welcome sent to others");
  });

  await test("module activation: each interested user notified exactly once", async () => {
    for (const user of [ids.a, ids.director, ids.b]) await setCountry(user, "PE");
    for (const user of [ids.a, ids.director]) {
      await as(user);
      await q("SELECT public.register_module_interest('marketplace')");
    }
    await as(ids.b);
    await q("SELECT public.register_module_interest('biblioteca')");
    await q("RESET ROLE");
    // Active without implementation is still coming_soon for users: no notification yet.
    await q("UPDATE modules SET status = 'active' WHERE id = 'marketplace'");
    assert(await count("SELECT 1 FROM notifications WHERE kind = 'module_available'") === 0, "notified before the module is usable");
    await as(ids.a);
    assert(accessOf(await myModules()).marketplace === "coming_soon", "active without implementation must stay coming_soon");
    await q("RESET ROLE");
    // The director is suspended before the module becomes usable: not notified.
    await q("UPDATE users SET status = 'suspended' WHERE id = $1", [ids.director]);
    await q("UPDATE modules SET implementation_available = true WHERE id = 'marketplace'");
    await q("UPDATE modules SET sort_order = 31 WHERE id = 'marketplace'");
    await q("UPDATE modules SET status = 'coming_soon' WHERE id = 'marketplace'");
    await q("UPDATE modules SET status = 'active' WHERE id = 'marketplace'");
    const { rows } = await q("SELECT user_id, link_path, dedupe_key FROM notifications WHERE kind = 'module_available' ORDER BY user_id");
    const expected = [ids.a];
    assert(JSON.stringify(rows.map((r) => r.user_id).sort()) === JSON.stringify(expected), `notified ${rows.map((r) => r.user_id)}`);
    assert(rows.every((r) => r.link_path === "/modulos/marketplace" && r.dedupe_key === "module_available:marketplace"), "wrong link or dedupe key");
    await as(ids.a);
    assert(await count("SELECT 1 FROM notifications WHERE kind = 'module_available'") === 1, "A should see own notification");
    assert(accessOf(await myModules()).marketplace === "available", "usable module must be available");
  });

  await test("abuse limits: repeated RPCs do not grow activity or duplicate consent", async () => {
    await setCountry(ids.a, "PE");
    await as(ids.a);
    for (let i = 0; i < 5; i++) {
      await q("SELECT public.record_session_started()");
      await q("SELECT public.register_module_interest('biblioteca')");
      await q("SELECT public.withdraw_module_interest('biblioteca')");
    }
    await q("INSERT INTO consent_records (user_id, document, version) VALUES ($1, 'terminos', 'v-dup')", [ids.a]);
    await expectError("INSERT INTO consent_records (user_id, document, version) VALUES ($1, 'terminos', 'v-dup')", [ids.a], "23505");
    await expectError("SELECT author_user_id FROM announcements");
    assert((await q("SELECT id, title FROM announcements")).rowCount >= 1, "announcement columns used by the app must stay readable");
    await q("RESET ROLE");
    const { rows } = await q("SELECT kind, count(*)::int AS n FROM activity_events WHERE user_id = $1 GROUP BY kind ORDER BY kind", [ids.a]);
    const byKind = Object.fromEntries(rows.map((r) => [r.kind, r.n]));
    assert(byKind["session.started"] === 1 && byKind["module.interest_added"] === 1 && byKind["module.interest_removed"] === 1, "activity not deduplicated: " + JSON.stringify(byKind));
  });

  await test("activity: no client read or write; session start recorded for active users", async () => {
    await as(ids.a);
    await q("SELECT public.record_session_started()");
    await expectError("SELECT 1 FROM activity_events");
    await expectError("INSERT INTO activity_events (user_id, kind) VALUES ($1, 'session.started')", [ids.a]);
    await expectError("SELECT app_private.record_activity($1, 'session.started')", [ids.a]);
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM activity_events WHERE user_id = $1 AND kind = 'session.started'", [ids.a]) === 1, "session not recorded");
  });

  await test("deletion: cascades interests, notifications and activity; authored announcements survive", async () => {
    await setCountry(ids.b, "PE");
    await q("INSERT INTO announcements (title, body, status, author_user_id) VALUES ('De B', 'x', 'published', $1)", [ids.b]);
    await q("INSERT INTO notifications (user_id, kind, title, body, link_path, dedupe_key) VALUES ($1, 'welcome', 't', 'b', '/panel', 'welcome')", [ids.b]);
    await as(ids.b);
    await q("SELECT public.register_module_interest('biblioteca')");
    await q("SELECT public.record_session_started()");
    await q("SELECT public.request_account_deletion()");
    await q("SELECT public.perform_account_deletion()");
    await q("RESET ROLE");
    await checkDeferred();
    for (const table of ["module_interests", "notifications", "activity_events"]) {
      assert(await count(`SELECT 1 FROM ${table} WHERE user_id = $1`, [ids.b]) === 0, `${table} not erased`);
    }
    assert(await count("SELECT 1 FROM announcements WHERE title = 'De B' AND author_user_id IS NULL") === 1, "announcement not kept anonymised");
  });
} finally {
  await q("ROLLBACK").catch(() => {});
  await client.end();
}

process.stdout.write(`${results.join("\n")}\n\n${results.length - failed}/${results.length} SQL/RLS checks passed.\n`);
if (failed) process.exit(1);
