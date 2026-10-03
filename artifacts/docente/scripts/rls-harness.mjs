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
    // Etapa 4: nobody changes their own roles (42501); the table trigger still keeps one active superadmin.
    await expectError("SELECT public.admin_revoke_role($1, 'superadmin')", [ids.superadmin], "42501");
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
  // --- Etapa 4: administración mínima (funciones public.admin_*). ---
  const stage2AdminFunctions = ["admin_grant_role", "admin_revoke_role", "admin_set_user_status"];
  const seedAnnouncement = (await q("SELECT id FROM announcements WHERE title = 'Aviso de prueba'")).rows[0].id;
  const draftAnnouncement = (await q("INSERT INTO announcements (title, body) VALUES ('Borrador etapa 4', 'Texto') RETURNING id")).rows[0].id;
  // One call per new function, with arguments that succeed for an admin with MFA.
  const adminCalls = {
    admin_list_users: ["SELECT * FROM public.admin_list_users()"],
    admin_list_modules: ["SELECT * FROM public.admin_list_modules()"],
    admin_set_module_status: ["SELECT public.admin_set_module_status('biblioteca', 'hidden')"],
    admin_set_module_emergency: ["SELECT public.admin_set_module_emergency('biblioteca', true)"],
    admin_set_module_country: ["SELECT public.admin_set_module_country('biblioteca', 'PE', false)"],
    admin_list_announcements: ["SELECT * FROM public.admin_list_announcements()"],
    admin_get_announcement: ["SELECT * FROM public.admin_get_announcement($1)", [seedAnnouncement]],
    admin_save_announcement: ["SELECT public.admin_save_announcement(null, 'Título', 'Texto', null, null, null, null, null)"],
    admin_publish_announcement: ["SELECT public.admin_publish_announcement($1)", [draftAnnouncement]],
    admin_unpublish_announcement: ["SELECT public.admin_unpublish_announcement($1)", [seedAnnouncement]],
    admin_list_catalog: ["SELECT * FROM public.admin_list_catalog('region')"],
    admin_rename_catalog_item: ["SELECT public.admin_rename_catalog_item('region', $1, 'Región renombrada')", [territory["SIN-R01"]]],
    admin_set_catalog_item_active: ["SELECT public.admin_set_catalog_item_active('region', $1, false)", [territory["SIN-R02"]]],
    admin_list_orgs: ["SELECT * FROM public.admin_list_orgs()"],
    admin_get_org: ["SELECT * FROM public.admin_get_org($1)", [orgA]],
    admin_create_test_org: ["SELECT public.admin_create_test_org('Org de prueba', 'PE')"],
    admin_set_org_status: ["SELECT public.admin_set_org_status($1, 'inactive')", [orgB]],
    admin_list_org_members: ["SELECT * FROM public.admin_list_org_members($1)", [orgA]],
    admin_add_org_member: ["SELECT public.admin_add_org_member($1, 'director@example.test', 'docente')", [orgB]],
    admin_remove_org_member: ["SELECT public.admin_remove_org_member($1, $2)", [orgA, ids.a]],
    admin_metric_overview: ["SELECT * FROM public.admin_metric_overview()"],
    admin_metric_signups: ["SELECT * FROM public.admin_metric_signups(30)"],
    admin_metric_active_users: ["SELECT * FROM public.admin_metric_active_users()"],
    admin_metric_distribution: ["SELECT * FROM public.admin_metric_distribution('region')"],
    admin_metric_module_interest: ["SELECT * FROM public.admin_metric_module_interest()"],
    admin_list_audit: ["SELECT * FROM public.admin_list_audit()"],
  };
  // Functions that write audit_logs (mutations plus reads of personal data): never stable.
  const auditingFunctions = [
    "admin_list_users", "admin_set_module_status", "admin_set_module_emergency", "admin_set_module_country",
    "admin_save_announcement", "admin_publish_announcement", "admin_unpublish_announcement",
    "admin_rename_catalog_item", "admin_set_catalog_item_active", "admin_create_test_org", "admin_set_org_status",
    "admin_list_org_members", "admin_add_org_member", "admin_remove_org_member",
  ];
  const asAdmin = () => as(ids.admin, { aal: "aal2" });
  const canon = (o) => JSON.stringify(Object.keys(o ?? {}).sort().map((k) => [k, o[k]]));
  const lima = (daysAgo, time) => `((now() AT TIME ZONE 'America/Lima')::date - ${daysAgo} + time '${time}') AT TIME ZONE 'America/Lima'`;
  const newAuthUser = async (email) => (await q("INSERT INTO auth.users (email, email_confirmed_at) VALUES ($1, now()) RETURNING id", [email])).rows[0].id;

  await test("admin functions: explicit execute grants, security definer, empty search_path, auditing ones volatile", async () => {
    const { rows } = await q(`
      SELECT p.proname, p.prosecdef, p.proconfig, p.provolatile,
        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
        EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x WHERE x.grantee = 0) AS public_exec
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'admin\\_%'`);
    const names = rows.map((r) => r.proname).filter((n) => !stage2AdminFunctions.includes(n)).sort();
    assert(JSON.stringify(names) === JSON.stringify(Object.keys(adminCalls).sort()), `admin functions without harness coverage: ${names}`);
    for (const r of rows) {
      assert(!r.anon_exec && !r.public_exec, `${r.proname}: anon/PUBLIC can execute`);
      assert(r.auth_exec, `${r.proname}: authenticated cannot execute`);
      assert(r.prosecdef, `${r.proname}: not security definer`);
      assert(JSON.stringify(r.proconfig) === JSON.stringify(['search_path=""']), `${r.proname}: search_path ${r.proconfig}`);
    }
    for (const name of auditingFunctions) {
      assert(rows.find((r) => r.proname === name)?.provolatile === "v", `${name} audits but is not volatile`);
    }
    const helpers = await q(`
      SELECT p.proname FROM pg_proc p
      WHERE p.pronamespace = 'app_private'::regnamespace AND p.proname LIKE 'admin\\_%'
        AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))`);
    assert(helpers.rowCount === 0, `app_private admin helpers executable by clients: ${helpers.rows.map((r) => r.proname)}`);
  });

  await test("admin functions: the rejection-test arguments succeed for admin and superadmin with MFA", async () => {
    for (const user of [ids.admin, ids.superadmin]) {
      await as(user, { aal: "aal2" });
      for (const [name, [sql, params]] of Object.entries(adminCalls)) {
        await q("SAVEPOINT c");
        try {
          await q(sql, params);
        } catch (error) {
          throw new Error(`${name} failed for an authorized admin: ${error.code} ${error.message}`);
        } finally {
          await q("ROLLBACK TO SAVEPOINT c");
          await q("SET CONSTRAINTS ALL DEFERRED");
        }
      }
    }
  });

  await test("admin functions: anon has no EXECUTE on any of them", async () => {
    await asAnon();
    for (const [name, [sql, params]] of Object.entries(adminCalls)) {
      await q("SAVEPOINT e");
      try {
        await q(sql, params);
        throw new Error(`${name}: anon call succeeded`);
      } catch (error) {
        await q("ROLLBACK TO SAVEPOINT e");
        // aclcheck_error = rejected before running (no EXECUTE), not by require_admin.
        assert(error.code === "42501" && error.routine === "aclcheck_error", `${name}: anon got ${error.code} from ${error.routine}`);
      }
    }
  });

  for (const [label, setup] of [
    ["docente with MFA", async () => as(ids.a, { aal: "aal2" })],
    ["admin without MFA (aal1)", async () => as(ids.admin, { aal: "aal1" })],
    ["suspended admin with MFA", async () => {
      await q("UPDATE users SET status = 'suspended' WHERE id = $1", [ids.admin]);
      await as(ids.admin, { aal: "aal2" });
    }],
  ]) {
    await test(`admin functions: ${label} is rejected with 42501 by require_admin`, async () => {
      await setup();
      for (const [name, [sql, params]] of Object.entries(adminCalls)) {
        await q("SAVEPOINT e");
        try {
          await q(sql, params);
          throw new Error(`${name}: call succeeded`);
        } catch (error) {
          await q("ROLLBACK TO SAVEPOINT e");
          await q("SET CONSTRAINTS ALL DEFERRED");
          assert(error.code === "42501" && error.routine === "exec_stmt_raise", `${name}: got ${error.code} from ${error.routine}: ${error.message}`);
        }
      }
    });
  }

  await test("admin with MFA cannot grant or revoke admin or superadmin", async () => {
    await q("INSERT INTO user_roles (user_id, role_code) VALUES ($1, 'admin')", [ids.b]);
    await asAdmin();
    await expectError("SELECT public.admin_grant_role($1, 'admin')", [ids.director]);
    await expectError("SELECT public.admin_grant_role($1, 'superadmin')", [ids.director]);
    await expectError("SELECT public.admin_revoke_role($1, 'admin')", [ids.b]);
    await expectError("SELECT public.admin_revoke_role($1, 'superadmin')", [ids.superadmin]);
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM user_roles WHERE role_code IN ('admin', 'superadmin')") === 3, "privileged roles changed");
  });

  await test("admin modules: demo untouchable, no activation without implementation, changes reach list_my_modules", async () => {
    await setCountry(ids.a, "PE");
    await q("INSERT INTO countries (code, name, currency, locale, time_zone, active) VALUES ('ZZ', 'Inactivo', 'PEN', 'es-PE', 'America/Lima', false)");
    await asAdmin();
    const list = (await q("SELECT module_id, country_codes, interest_count FROM public.admin_list_modules()")).rows;
    assert(JSON.stringify(list.map((r) => r.module_id)) === JSON.stringify(future), `admin modules ${list.map((r) => r.module_id)}`);
    assert(list.every((r) => JSON.stringify(r.country_codes) === '["PE"]' && r.interest_count === "0"), "unexpected countries or interest");
    await expectError("SELECT public.admin_set_module_status('demo', 'hidden')");
    await expectError("SELECT public.admin_set_module_emergency('demo', true)");
    await expectError("SELECT public.admin_set_module_country('demo', 'PE', false)");
    await expectError("SELECT public.admin_set_module_status('no-existe', 'hidden')", [], "P0002");
    await expectError("SELECT public.admin_set_module_emergency('no-existe', true)", [], "P0002");
    await expectError("SELECT public.admin_set_module_country('no-existe', 'PE', true)", [], "P0002");
    await expectError("SELECT public.admin_set_module_status('biblioteca', 'archived')", [], "22023");
    await expectError("SELECT public.admin_set_module_status('biblioteca', null)", [], "22023");
    await expectError("SELECT public.admin_set_module_emergency('biblioteca', null)", [], "22023");
    await expectError("SELECT public.admin_set_module_country('biblioteca', 'XX', true)", [], "22023");
    await expectError("SELECT public.admin_set_module_country('biblioteca', 'ZZ', true)", [], "22023");
    await expectError("SELECT public.admin_set_module_country('biblioteca', 'PE', null)", [], "22023");
    await expectError("SELECT public.admin_set_module_status('biblioteca', 'active')", [], "23514");

    await q("SELECT public.admin_set_module_emergency('generador-ia', true)");
    await q("SELECT public.admin_set_module_country('marketplace', 'PE', false)");
    await q("SELECT public.admin_set_module_status('biblioteca', 'hidden')");
    await as(ids.a);
    let access = accessOf(await myModules());
    assert(access["generador-ia"] === "disabled", "emergency not applied");
    assert(!("marketplace" in access) && !("biblioteca" in access), `country/hidden not applied: ${JSON.stringify(access)}`);
    assert(access["cursos-simulacros"] === "coming_soon" && access.demo === "requires_entitlement", "other modules changed");

    await asAdmin();
    await q("SELECT public.admin_set_module_emergency('generador-ia', false)");
    await q("SELECT public.admin_set_module_country('marketplace', 'PE', true)");
    await q("SELECT public.admin_set_module_country('marketplace', 'PE', true)");
    await q("SELECT public.admin_set_module_status('biblioteca', 'coming_soon')");
    await as(ids.a);
    access = accessOf(await myModules());
    for (const id of future) assert(access[id] === "coming_soon", `${id} not restored: ${access[id]}`);

    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM module_availability WHERE module_id = 'marketplace' AND country_code = 'PE' AND required_entitlement IS NULL") === 1, "availability not restored without entitlement");
    await q("UPDATE modules SET implementation_available = true WHERE id = 'cursos-simulacros'");
    await asAdmin();
    await q("SELECT public.admin_set_module_status('cursos-simulacros', 'active')");
    await as(ids.a);
    assert(accessOf(await myModules())["cursos-simulacros"] === "available", "implemented module not activated");
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM modules WHERE id = 'demo' AND status = 'active' AND NOT emergency_disabled") === 1, "demo changed");
  });

  await test("admin announcements: create, publish (visible), unpublish (invisible); published is not editable", async () => {
    await setCountry(ids.a, "PE");
    await asAdmin();
    const id = (await q("SELECT public.admin_save_announcement(null, 'Aviso etapa 4', 'Cuerpo', null, null, $1, null, null) AS id", [["PE"]])).rows[0].id;
    let row = (await q("SELECT * FROM public.admin_get_announcement($1)", [id])).rows;
    assert(row.length === 1 && row[0].status === "draft" && row[0].body === "Cuerpo" && JSON.stringify(row[0].role_codes) === "[]", "draft not created as expected");
    const visible = async () => { await as(ids.a); const n = await count("SELECT 1 FROM announcements WHERE id = $1", [id]); await asAdmin(); return n; };
    assert(await visible() === 0, "draft visible to docente");
    await q("SELECT public.admin_save_announcement($1, 'Aviso editado', 'Cuerpo 2', null, null, $2, $3, $4)", [id, ["PE"], ["docente"], ["gratis"]]);
    await q("SELECT public.admin_publish_announcement($1)", [id]);
    assert(await visible() === 1, "published not visible to docente");
    await expectError("SELECT public.admin_publish_announcement($1)", [id], "23514");
    await expectError("SELECT public.admin_save_announcement($1, 't', 'b', null, null, null, null, null)", [id], "23514");
    await q("SELECT public.admin_unpublish_announcement($1)", [id]);
    assert(await visible() === 0, "unpublished still visible");
    await expectError("SELECT public.admin_unpublish_announcement($1)", [id], "23514");
    const missing = "00000000-0000-0000-0000-000000000000";
    await expectError("SELECT * FROM public.admin_get_announcement($1)", [missing], "P0002");
    await expectError("SELECT public.admin_publish_announcement($1)", [missing], "P0002");
    await expectError("SELECT public.admin_unpublish_announcement($1)", [missing], "P0002");
    await expectError("SELECT public.admin_save_announcement($1, 't', 'b', null, null, null, null, null)", [missing], "P0002");
    await expectError("SELECT public.admin_save_announcement(null, null, 'b', null, null, null, null, null)", [], "22023");
    await expectError("SELECT public.admin_save_announcement(null, 't', 'b', null, null, $1, null, null)", [["XX"]], "23514");
    await expectError("SELECT public.admin_save_announcement(null, 't', 'b', null, null, null, null, $1)", [["premium"]], "23514");
    await expectError("SELECT public.admin_save_announcement(null, 't', 'b', now(), now() - interval '1 day', null, null, null)", [], "23514");
    await expectError("SELECT * FROM public.admin_list_announcements('archived')", [], "22023");
    await expectError("SELECT * FROM public.admin_list_announcements(null, 0)", [], "22023");
    const drafts = (await q("SELECT id, total_count FROM public.admin_list_announcements('draft')")).rows;
    assert(drafts.some((r) => r.id === id) && drafts.some((r) => r.id === draftAnnouncement) && drafts.every((r) => r.total_count === String(drafts.length)), "draft list wrong");
    assert((await q("SELECT 1 FROM public.admin_list_announcements(null, 2)")).rowCount === 0, "out-of-range page returned rows");
    await q("RESET ROLE");
    row = (await q("SELECT title, status, author_user_id, country_codes, role_codes, plan_codes FROM announcements WHERE id = $1", [id])).rows[0];
    assert(row.title === "Aviso editado" && row.status === "draft" && row.author_user_id === ids.admin, "edit or author wrong");
    assert(JSON.stringify([row.country_codes, row.role_codes, row.plan_codes]) === '[["PE"],["docente"],["gratis"]]', "audience not saved");
  });

  await test("admin catalogs: list, filter, deactivate removes from active reads, rename is reflected", async () => {
    await asAdmin();
    let rows = (await q("SELECT code, name, parent_id, parent_name, is_synthetic, total_count FROM public.admin_list_catalog('region')")).rows;
    assert(JSON.stringify(rows.map((r) => r.code)) === '["SIN-R01","SIN-R02"]' && rows.every((r) => r.is_synthetic && r.parent_id === null && r.total_count === "2"), "regions wrong");
    rows = (await q("SELECT code, parent_name FROM public.admin_list_catalog('ugel', $1)", [territory["SIN-R01"]])).rows;
    assert(JSON.stringify(rows.map((r) => r.code)) === '["SIN-U01","SIN-U02"]' && rows.every((r) => r.parent_name === "Región sintética Norte"), "UGEL by region wrong");
    rows = (await q("SELECT code FROM public.admin_list_catalog('ugel', null, ' SUR ')")).rows;
    assert(JSON.stringify(rows.map((r) => r.code)) === '["SIN-U03"]', "UGEL search wrong");
    rows = (await q("SELECT code FROM public.admin_list_catalog('grade', $1)", [catalog.primaria])).rows;
    assert(JSON.stringify(rows.map((r) => r.code)) === JSON.stringify([1, 2, 3, 4, 5, 6].map((n) => `primaria-${n}`)), "grades by level wrong");
    rows = (await q("SELECT code, is_synthetic, parent_id FROM public.admin_list_catalog('level')")).rows;
    assert(JSON.stringify(rows.map((r) => r.code)) === '["inicial","primaria","secundaria"]' && rows.every((r) => r.is_synthetic === false && r.parent_id === null), "levels wrong");
    await expectError("SELECT * FROM public.admin_list_catalog('region', $1)", [territory["SIN-R01"]], "22023");
    await expectError("SELECT * FROM public.admin_list_catalog('level', $1)", [catalog.primaria], "22023");
    await expectError("SELECT * FROM public.admin_list_catalog('area')", [], "22023");
    await expectError("SELECT * FROM public.admin_list_catalog('grade', null, null, 0)", [], "22023");

    // An onboarded profile in the region stays valid after deactivation.
    await q("RESET ROLE");
    await q("UPDATE profiles SET display_name = 'Ana', country_code = 'PE', region_id = $2, onboarding_step = 3, onboarding_completed_at = now() WHERE user_id = $1", [ids.a, territory["SIN-R02"]]);
    await q("INSERT INTO profile_education_selections (user_id, catalog_id) VALUES ($1, $2)", [ids.a, catalog.primaria]);
    await checkDeferred();
    await q("SET CONSTRAINTS ALL DEFERRED");
    await asAdmin();
    await q("SELECT public.admin_set_catalog_item_active('region', $1, false)", [territory["SIN-R02"]]);
    await q("SELECT public.admin_set_catalog_item_active('level', $1, false)", [catalog.inicial]);
    await q("SELECT public.admin_rename_catalog_item('ugel', $1, '  UGEL renombrada  ')", [territory["SIN-U01"]]);
    await expectError("SELECT public.admin_set_catalog_item_active('ugel', $1, null)", [territory["SIN-U01"]], "22023");
    await expectError("SELECT public.admin_rename_catalog_item('region', $1, 'x')", [territory["SIN-U01"]], "P0002");
    await expectError("SELECT public.admin_set_catalog_item_active('grade', $1, true)", [catalog.primaria], "P0002");
    await expectError("SELECT public.admin_rename_catalog_item('ugel', $1, 'x')", ["00000000-0000-0000-0000-000000000000"], "P0002");
    await expectError("SELECT public.admin_rename_catalog_item('ugel', $1, '   ')", [territory["SIN-U01"]], "22023");
    await expectError("SELECT public.admin_rename_catalog_item('ugel', $1, null)", [territory["SIN-U01"]], "22023");
    await expectError("SELECT public.admin_rename_catalog_item('region', $1, repeat('x', 201))", [territory["SIN-R01"]], "22023");
    await q("SELECT public.admin_rename_catalog_item('region', $1, repeat('x', 200))", [territory["SIN-R01"]]);
    await expectError("SELECT public.admin_rename_catalog_item('level', $1, repeat('x', 121))", [catalog.primaria], "22023");
    await q("SELECT public.admin_rename_catalog_item('level', $1, repeat('x', 120))", [catalog.primaria]);
    await as(ids.a);
    assert(JSON.stringify((await q("SELECT official_code FROM regions WHERE active ORDER BY 1")).rows.map((r) => r.official_code)) === '["SIN-R01"]', "inactive region still in active reads");
    assert(await count("SELECT 1 FROM education_catalog WHERE active AND code = 'inicial'") === 0, "inactive level still in active reads");
    assert((await q("SELECT name FROM ugels WHERE official_code = 'SIN-U01'")).rows[0].name === "UGEL renombrada", "rename not reflected (trimmed)");
    await q("RESET ROLE");
    await q("UPDATE profiles SET display_name = 'Ana María' WHERE user_id = $1", [ids.a]);
    await checkDeferred();
  });

  await test("admin orgs: create with workspace, membership grants and revokes org.read, inactive blocks", async () => {
    await asAdmin();
    const org = (await q("SELECT public.admin_create_test_org('  Org etapa 4  ', 'PE') AS id")).rows[0].id;
    await expectError("SELECT public.admin_create_test_org('   ', 'PE')", [], "22023");
    await expectError("SELECT public.admin_create_test_org(repeat('x', 201), 'PE')", [], "22023");
    await expectError("SELECT public.admin_create_test_org('Org', 'XX')", [], "22023");
    const orgs = (await q("SELECT id, member_count, total_count FROM public.admin_list_orgs()")).rows;
    assert(orgs.find((r) => r.id === orgA)?.member_count === "2" && orgs.every((r) => r.total_count === "3"), "org list or active member count wrong");
    await expectError("SELECT * FROM public.admin_list_orgs('bogus')", [], "22023");
    const one = (await q("SELECT * FROM public.admin_get_org($1)", [orgA])).rows;
    assert(one.length === 1 && one[0].name === "Org A" && one[0].member_count === "2" && one[0].is_test && one[0].status === "active" && !("total_count" in one[0]), `get org ${JSON.stringify(one)}`);
    await expectError("SELECT * FROM public.admin_get_org($1)", ["00000000-0000-0000-0000-000000000000"], "P0002");
    const orgReadByB = async () => { await as(ids.b); const n = await count("SELECT 1 FROM organizations WHERE id = $1", [org]); await asAdmin(); return n; };
    assert(await orgReadByB() === 0, "B sees org before membership");

    await q("SELECT public.admin_add_org_member($1, ' B@Example.Test ', 'docente')", [org]);
    assert(await orgReadByB() === 1, "member has no org.read");
    await expectError("SELECT public.admin_add_org_member($1, 'b@example.test', 'director')", [org], "23505");
    await expectError("SELECT public.admin_add_org_member($1, 'nadie@example.test', 'docente')", [org], "P0002");
    await expectError("SELECT public.admin_add_org_member($1, 'suspended@example.test', 'docente')", [org], "P0002");
    await expectError("SELECT public.admin_add_org_member($1, 'a@example.test', 'admin')", [org], "22023");
    let members = (await q("SELECT user_id, email, role_code, status FROM public.admin_list_org_members($1)", [org])).rows;
    assert(members.length === 1 && members[0].user_id === ids.b && members[0].email === "b@example.test" && members[0].status === "active", "members wrong");

    await q("SELECT public.admin_remove_org_member($1, $2)", [org, ids.b]);
    assert(await orgReadByB() === 0, "removed member keeps org.read");
    await expectError("SELECT public.admin_remove_org_member($1, $2)", [org, ids.b], "P0002");
    await q("SELECT public.admin_add_org_member($1, 'b@example.test', 'director')", [org]);
    assert(await orgReadByB() === 1, "reactivated member has no org.read");
    members = (await q("SELECT role_code, status, removed_at FROM public.admin_list_org_members($1)", [org])).rows;
    assert(members.length === 1 && members[0].role_code === "director" && members[0].status === "active" && members[0].removed_at === null, "membership not reactivated with new role");

    await q("SELECT public.admin_set_org_status($1, 'inactive')", [org]);
    assert(await orgReadByB() === 0, "inactive org still readable");
    await expectError("SELECT public.admin_add_org_member($1, 'a@example.test', 'docente')", [org], "23514");
    await expectError("SELECT public.admin_set_org_status($1, 'archived')", [org], "22023");

    members = (await q("SELECT email, status FROM public.admin_list_org_members($1)", [orgA])).rows;
    assert(JSON.stringify(members.map((r) => r.status)) === '["active","active","removed"]', "org A members (with removed) wrong");

    const missing = "00000000-0000-0000-0000-000000000000";
    await expectError("SELECT public.admin_set_org_status($1, 'active')", [missing], "P0002");
    await expectError("SELECT * FROM public.admin_list_org_members($1)", [missing], "P0002");
    await expectError("SELECT public.admin_add_org_member($1, 'a@example.test', 'docente')", [missing], "P0002");
    await expectError("SELECT public.admin_remove_org_member($1, $2)", [missing, ids.a], "P0002");

    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM workspaces WHERE organization_id = $1 AND kind = 'institutional'", [org]) === 1, "workspace not created");
    assert(await count("SELECT 1 FROM organizations WHERE id = $1 AND name = 'Org etapa 4' AND is_test", [org]) === 1, "org not trimmed or not test");
    const real = (await q("INSERT INTO organizations (name, country_code, is_test) VALUES ('Real', 'PE', false) RETURNING id")).rows[0].id;
    await q("INSERT INTO memberships (user_id, organization_id, role_code) VALUES ($1, $2, 'docente')", [ids.a, real]);
    await asAdmin();
    await expectError("SELECT public.admin_set_org_status($1, 'inactive')", [real], "23514");
    await expectError("SELECT public.admin_add_org_member($1, 'b@example.test', 'docente')", [real], "23514");
    await expectError("SELECT public.admin_remove_org_member($1, $2)", [real, ids.a], "23514");
  });

  await test("admin metrics: exact figures on a known dataset; seed users never count", async () => {
    await q("UPDATE users SET is_seed = true"); // harness fixtures become seed
    const mk = async (email, { daysAgo, time = "12:00", status = "active", seed = false, onboarded = true, region = null, picks = [] }) => {
      const id = await newAuthUser(email);
      await q(`UPDATE users SET is_seed = $2, status = $3, created_at = ${lima(daysAgo, time)} WHERE id = $1`, [id, seed, status]);
      await q("UPDATE profiles SET display_name = 'Docente', country_code = 'PE', region_id = $2, onboarding_step = 3, onboarding_completed_at = CASE WHEN $3 THEN now() END WHERE user_id = $1", [id, region, onboarded]);
      for (const code of picks) await q("INSERT INTO profile_education_selections (user_id, catalog_id) VALUES ($1, $2)", [id, catalog[code]]);
      return id;
    };
    const u1 = await mk("m1@example.test", { daysAgo: 0, region: territory["SIN-R01"], picks: ["primaria", "primaria-2"] });
    // 23:30 in Lima is already the next day in UTC: it must count for yesterday.
    const u2 = await mk("m2@example.test", { daysAgo: 1, time: "23:30", region: territory["SIN-R01"], picks: ["primaria", "primaria-1", "secundaria", "secundaria-1"] });
    const u3 = await mk("m3@example.test", { daysAgo: 6, time: "10:00", picks: ["inicial"] });
    const u4 = await mk("m4@example.test", { daysAgo: 6, time: "08:00", status: "suspended", region: territory["SIN-R02"], picks: ["secundaria"] });
    const u5 = await mk("m5@example.test", { daysAgo: 40, onboarded: false });
    const s1 = await mk("s1@example.test", { daysAgo: 0, seed: true, region: territory["SIN-R02"], picks: ["primaria", "primaria-3"] });
    await checkDeferred();
    await q("DELETE FROM activity_events"); // drop onboarding events fired by the fixtures
    for (const [user, ago] of [[u1, "1 hour"], [u1, "2 days"], [u2, "3 days"], [u3, "10 days"], [u4, "31 days"], [u5, "7 days 1 minute"], [s1, "1 hour"]]) {
      await q("INSERT INTO activity_events (user_id, kind, created_at) VALUES ($1, 'session.started', now() - $2::interval)", [user, ago]);
    }
    for (const [user, module] of [[u1, "biblioteca"], [u1, "marketplace"], [u2, "biblioteca"], [u4, "generador-ia"], [s1, "biblioteca"], [s1, "cursos-simulacros"]]) {
      await q("INSERT INTO module_interests (user_id, module_id) VALUES ($1, $2)", [user, module]);
    }
    const days = (n) => `SELECT ((now() AT TIME ZONE 'America/Lima')::date - g)::text AS day FROM generate_series(${n - 1}, 0, -1) g`;
    const expectedDays7 = (await q(days(7))).rows.map((r) => r.day);
    const firstDay90 = (await q(days(90))).rows[0].day;

    await asAdmin();
    const overview = (await q("SELECT total_users::int, active_users::int, suspended_users::int, onboarded_users::int FROM public.admin_metric_overview()")).rows;
    assert(JSON.stringify(overview) === JSON.stringify([{ total_users: 5, active_users: 4, suspended_users: 1, onboarded_users: 3 }]), `overview ${JSON.stringify(overview)}`);

    let rows = (await q("SELECT day::text, signups::int FROM public.admin_metric_signups(7)")).rows;
    assert(JSON.stringify(rows.map((r) => r.day)) === JSON.stringify(expectedDays7), `signup days ${rows.map((r) => r.day)}`);
    assert(JSON.stringify(rows.map((r) => r.signups)) === "[2,0,0,0,0,1,1]", `signups ${rows.map((r) => r.signups)}`);
    rows = (await q("SELECT signups::int FROM public.admin_metric_signups(1)")).rows;
    assert(JSON.stringify(rows) === '[{"signups":1}]', `signups today ${JSON.stringify(rows)}`);
    rows = (await q("SELECT day::text, signups::int FROM public.admin_metric_signups(90)")).rows;
    assert(rows.length === 90 && rows[0].day === firstDay90 && rows.reduce((s, r) => s + r.signups, 0) === 5, "90-day signups wrong");
    assert((await q("SELECT 1 FROM public.admin_metric_signups()")).rowCount === 30, "default window is not 30 days");
    await expectError("SELECT * FROM public.admin_metric_signups(0)", [], "22023");
    await expectError("SELECT * FROM public.admin_metric_signups(91)", [], "22023");
    await expectError("SELECT * FROM public.admin_metric_signups(null)", [], "22023");

    rows = (await q("SELECT window_days, active_users::int FROM public.admin_metric_active_users()")).rows;
    assert(JSON.stringify(rows) === JSON.stringify([{ window_days: 1, active_users: 1 }, { window_days: 7, active_users: 2 }, { window_days: 30, active_users: 4 }]), `active ${JSON.stringify(rows)}`);

    rows = (await q("SELECT item_id, name, users::int FROM public.admin_metric_distribution('region')")).rows;
    assert(JSON.stringify(rows) === JSON.stringify([{ item_id: territory["SIN-R01"], name: "Región sintética Norte", users: 2 }, { item_id: null, name: null, users: 1 }]), `region ${JSON.stringify(rows)}`);
    rows = (await q("SELECT item_id, name, users::int FROM public.admin_metric_distribution('level')")).rows;
    assert(JSON.stringify(rows) === JSON.stringify([{ item_id: catalog.primaria, name: "Primaria", users: 2 }, { item_id: catalog.inicial, name: "Inicial", users: 1 }, { item_id: catalog.secundaria, name: "Secundaria", users: 1 }]), `level ${JSON.stringify(rows)}`);
    rows = (await q("SELECT name, users::int FROM public.admin_metric_distribution('grade')")).rows;
    assert(JSON.stringify(rows) === JSON.stringify([{ name: "1.º de primaria", users: 1 }, { name: "1.º de secundaria", users: 1 }, { name: "2.º de primaria", users: 1 }]), `grade ${JSON.stringify(rows)}`);
    await expectError("SELECT * FROM public.admin_metric_distribution('ugel')", [], "22023");

    rows = (await q("SELECT module_id, interested::int FROM public.admin_metric_module_interest()")).rows;
    assert(JSON.stringify(rows) === JSON.stringify([{ module_id: "generador-ia", interested: 1 }, { module_id: "biblioteca", interested: 2 }, { module_id: "marketplace", interested: 1 }, { module_id: "cursos-simulacros", interested: 0 }]), `interest ${JSON.stringify(rows)}`);
  });

  await test("admin audit: each mutation leaves exactly one redacted record; personal-data reads audited, others not", async () => {
    await setCountry(ids.a, "PE");
    const auditedCall = async (sql, params, expected) => {
      await q("RESET ROLE");
      const before = (await q("SELECT coalesce(max(id), 0) AS id FROM audit_logs")).rows[0].id;
      await asAdmin();
      const result = await q(sql, params);
      await q("RESET ROLE");
      const { rows } = await q("SELECT actor_user_id, actor_context, action, resource_type, resource_id, result, details FROM audit_logs WHERE id > $1", [before]);
      if (!expected) {
        assert(rows.length === 0, `${sql}: unexpected audit ${rows.map((r) => r.action)}`);
        return result;
      }
      assert(rows.length === 1, `${sql}: ${rows.length} audit records`);
      const [r] = rows;
      assert(r.action === expected.action && r.actor_user_id === ids.admin && r.actor_context === "admin" && r.result === "success", `${expected.action}: wrong record ${JSON.stringify(r)}`);
      const expectedId = typeof expected.id === "function" ? expected.id(result) : expected.id ?? null;
      assert(r.resource_type === expected.type && r.resource_id === expectedId, `${expected.action}: resource ${r.resource_type}/${r.resource_id}`);
      assert(canon(r.details) === canon(expected.details), `${expected.action}: details ${JSON.stringify(r.details)}`);
      assert(!/@|aviso|cuerpo|org audit|renombr/i.test(JSON.stringify(r.details)), `${expected.action}: details leak text`);
      return result;
    };
    const firstValue = (result) => String(Object.values(result.rows[0])[0]);
    const R01 = territory["SIN-R01"];

    await auditedCall("SELECT * FROM public.admin_list_users('a@example', 'active', 'docente', 1)", [], { action: "users.searched", type: "user", details: { has_query: true, status: "active", role: "docente", page: 1 } });
    await auditedCall("SELECT * FROM public.admin_list_users()", [], { action: "users.searched", type: "user", details: { has_query: false, status: null, role: null, page: 1 } });
    await auditedCall("SELECT public.admin_set_module_status('biblioteca', 'hidden')", [], { action: "module.status_changed", type: "module", id: "biblioteca", details: { status: "hidden", previous: "coming_soon" } });
    await auditedCall("SELECT public.admin_set_module_emergency('biblioteca', true)", [], { action: "module.emergency_changed", type: "module", id: "biblioteca", details: { disabled: true } });
    await auditedCall("SELECT public.admin_set_module_country('biblioteca', 'PE', false)", [], { action: "module.country_changed", type: "module", id: "biblioteca", details: { country: "PE", enabled: false } });

    const created = await auditedCall("SELECT public.admin_save_announcement(null, 'Aviso audit', 'Cuerpo audit', null, null, null, null, null) AS id", [], { action: "announcement.created", type: "announcement", id: firstValue, details: {} });
    const ann = firstValue(created);
    await auditedCall("SELECT public.admin_save_announcement($1, 'Aviso audit 2', 'Cuerpo audit 2', null, null, null, null, null)", [ann], { action: "announcement.updated", type: "announcement", id: ann, details: {} });
    await auditedCall("SELECT public.admin_publish_announcement($1)", [ann], { action: "announcement.published", type: "announcement", id: ann, details: {} });
    await auditedCall("SELECT public.admin_unpublish_announcement($1)", [ann], { action: "announcement.unpublished", type: "announcement", id: ann, details: {} });

    await auditedCall("SELECT public.admin_rename_catalog_item('region', $1, 'Región renombrada')", [R01], { action: "catalog.renamed", type: "territory_unit", id: R01, details: { kind: "region", code: "SIN-R01" } });
    await auditedCall("SELECT public.admin_set_catalog_item_active('level', $1, false)", [catalog.inicial], { action: "catalog.status_changed", type: "education_catalog", id: catalog.inicial, details: { kind: "level", code: "inicial", active: false } });

    const orgResult = await auditedCall("SELECT public.admin_create_test_org('Org audit', 'PE') AS id", [], { action: "org.created", type: "organization", id: firstValue, details: { country: "PE" } });
    const org = firstValue(orgResult);
    await auditedCall("SELECT public.admin_add_org_member($1, 'a@example.test', 'director')", [org], { action: "org.member_added", type: "organization", id: org, details: { user_id: ids.a, role: "director" } });
    await auditedCall("SELECT * FROM public.admin_list_org_members($1)", [org], { action: "org.members_listed", type: "organization", id: org, details: {} });
    await auditedCall("SELECT public.admin_remove_org_member($1, $2)", [org, ids.a], { action: "org.member_removed", type: "organization", id: org, details: { user_id: ids.a } });
    await auditedCall("SELECT public.admin_set_org_status($1, 'inactive')", [org], { action: "org.status_changed", type: "organization", id: org, details: { status: "inactive" } });

    // Reads without personal data are not audited (the audit list does not audit itself).
    for (const sql of [
      "SELECT * FROM public.admin_list_modules()",
      "SELECT * FROM public.admin_list_announcements()",
      `SELECT * FROM public.admin_get_announcement('${ann}')`,
      "SELECT * FROM public.admin_list_catalog('ugel')",
      "SELECT * FROM public.admin_list_orgs()",
      `SELECT * FROM public.admin_get_org('${org}')`,
      "SELECT * FROM public.admin_metric_overview()",
      "SELECT * FROM public.admin_metric_signups()",
      "SELECT * FROM public.admin_metric_active_users()",
      "SELECT * FROM public.admin_metric_distribution('level')",
      "SELECT * FROM public.admin_metric_module_interest()",
      "SELECT * FROM public.admin_list_audit()",
    ]) {
      await auditedCall(sql, [], null);
    }
    // A failed action leaves no record (the exception rolls the audit back).
    await asAdmin();
    await expectError("SELECT public.admin_set_module_status('demo', 'hidden')");
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM audit_logs WHERE resource_id = 'demo'") === 0, "denied action audited");
  });

  await test("admin users: search treats % _ and \\ as literals; filters, pagination and minimal fields", async () => {
    const pct = await newAuthUser("pct@example.test");
    const under = await newAuthUser("under_score@example.test");
    await newAuthUser("underxscore@example.test");
    const back = await newAuthUser("back@example.test");
    await q("UPDATE profiles SET display_name = '100% docente' WHERE user_id = $1", [pct]);
    await q("UPDATE profiles SET display_name = 'Ana' WHERE user_id = $1", [under]);
    await q("UPDATE profiles SET display_name = 'con \\ barra' WHERE user_id = $1", [back]);
    const pag = [];
    for (let i = 0; i < 23; i++) pag.push(await newAuthUser(`pag-${i}@example.test`));
    const totalUsers = await count("SELECT 1 FROM users");

    await asAdmin();
    const search = async (query, ...rest) => (await q("SELECT * FROM public.admin_list_users($1, $2, $3, $4)", [query, rest[0] ?? null, rest[1] ?? null, rest[2] ?? 1])).rows;
    const idsOf = (rows) => rows.map((r) => r.user_id).sort();
    assert(JSON.stringify(idsOf(await search("%"))) === JSON.stringify([pct]), "% is not literal");
    assert(JSON.stringify(idsOf(await search("_"))) === JSON.stringify([under]), "_ is not literal");
    assert(JSON.stringify(idsOf(await search("r_s"))) === JSON.stringify([under]), "_ matched any character");
    assert(JSON.stringify(idsOf(await search("\\"))) === JSON.stringify([back]), "backslash is not literal");
    assert(JSON.stringify(idsOf(await search("  ANA  "))) === JSON.stringify([under]), "case-insensitive name search failed");
    assert(JSON.stringify(idsOf(await search("SUPERADMIN@"))) === JSON.stringify([ids.superadmin]), "email search failed");
    let rows = await search("   ");
    assert(rows.length === 20 && rows[0].total_count === String(totalUsers), "blank query must not filter");
    await search(` ${"x".repeat(100)} `);
    await expectError("SELECT * FROM public.admin_list_users($1)", ["x".repeat(101)], "22023");
    await expectError("SELECT * FROM public.admin_list_users(null, 'bogus')", [], "22023");
    await expectError("SELECT * FROM public.admin_list_users(null, null, 'bogus')", [], "22023");
    await expectError("SELECT * FROM public.admin_list_users(null, null, null, 0)", [], "22023");
    await expectError("SELECT * FROM public.admin_list_users(null, null, null, null)", [], "22023");

    rows = await search(null, null, "admin");
    assert(rows.length === 1 && rows[0].user_id === ids.admin, "role filter wrong");
    const [admin] = rows;
    assert(admin.email === "admin@example.test" && JSON.stringify(admin.roles) === '["admin","docente"]' && admin.status === "active" && admin.country_code === null && admin.display_name === null && admin.total_count === "1", `admin row ${JSON.stringify(admin)}`);
    assert(JSON.stringify(Object.keys(admin).sort()) === JSON.stringify(["country_code", "created_at", "display_name", "email", "roles", "status", "total_count", "user_id"]), "unexpected user columns");
    rows = await search(null, "suspended");
    assert(rows.length === 1 && rows[0].user_id === ids.suspended, "status filter wrong");

    const page1 = await search("pag-");
    const page2 = await search("pag-", null, null, 2);
    const page3 = await search("pag-", null, null, 3);
    assert(page1.length === 20 && page2.length === 3 && page3.length === 0, `pages ${page1.length}/${page2.length}/${page3.length}`);
    assert([...page1, ...page2].every((r) => r.total_count === "23"), "total_count wrong");
    const all = [...page1, ...page2].map((r) => r.user_id);
    assert(new Set(all).size === 23 && JSON.stringify([...all].sort()) === JSON.stringify([...pag].sort()), "pages overlap or miss users");
    assert(JSON.stringify(all) === JSON.stringify([...all].sort()), "same created_at must order by user_id");
  });

  await test("admin audit list: exact filters, half-open date range, deleted actor, pagination", async () => {
    await asAdmin();
    await q("SELECT public.admin_set_module_emergency('biblioteca', true)");
    await q("SELECT public.admin_set_module_status('biblioteca', 'hidden')");
    await q("RESET ROLE");
    const ghost = "11111111-1111-1111-1111-111111111111";
    await q("INSERT INTO audit_logs (actor_user_id, actor_context, action, resource_type, resource_id, result) VALUES ($1, 'admin', 'test.ghost', 'test', 'x', 'success')", [ghost]);
    for (let i = 0; i < 25; i++) {
      await q("INSERT INTO audit_logs (actor_context, action, resource_type, resource_id, result) VALUES ('system', 'test.bulk', 'test', $1, 'success')", [String(i)]);
    }
    await asAdmin();
    const list = async (args) => (await q("SELECT * FROM public.admin_list_audit($1, $2, $3, $4, $5, $6, $7)", [args.action ?? null, args.actor ?? null, args.type ?? null, args.resource ?? null, args.from ?? null, args.to ?? null, args.page ?? 1])).rows;
    let rows = await list({ action: "module.emergency_changed" });
    assert(rows.length === 1 && rows[0].actor_email === "admin@example.test" && rows[0].resource_id === "biblioteca" && canon(rows[0].details) === canon({ disabled: true }) && rows[0].total_count === "1", `action filter ${JSON.stringify(rows)}`);
    rows = await list({ actor: ids.admin });
    assert(JSON.stringify(rows.map((r) => r.action)) === '["module.status_changed","module.emergency_changed"]', `actor filter ${rows.map((r) => r.action)}`);
    assert((await list({ type: "module", resource: "biblioteca" })).length === 2, "resource filter wrong");
    assert((await list({ resource: "bibliotec" })).length === 0, "resource filter must be exact");
    assert((await list({ action: "module" })).length === 0, "action filter must be exact");
    rows = await list({ action: "test.ghost" });
    assert(rows.length === 1 && rows[0].actor_user_id === ghost && rows[0].actor_email === null, "deleted actor must have null email");
    const now = (await q("SELECT now()::text AS t")).rows[0].t;
    assert((await list({ action: "test.ghost", from: now })).length === 1, "from must be inclusive");
    assert((await list({ action: "test.ghost", to: now })).length === 0, "to must be exclusive");
    await expectError("SELECT * FROM public.admin_list_audit(null, null, null, null, $1, $1)", [now], "22023");
    await expectError("SELECT * FROM public.admin_list_audit(p_page => 0)", [], "22023");
    const p1 = await list({ action: "test.bulk" });
    const p2 = await list({ action: "test.bulk", page: 2 });
    assert(p1.length === 20 && p2.length === 5 && p1[0].total_count === "25", `audit pages ${p1.length}/${p2.length}`);
    assert(p1[0].resource_id === "24" && p2[4].resource_id === "0", "audit must be newest first (id desc)");
  });

  // --- Etapa 4: correcciones de la auditoría de seguridad. ---
  const auditCount = async (action, resourceId) => {
    await q("RESET ROLE");
    return count("SELECT 1 FROM audit_logs WHERE action = $1 AND resource_id = $2", [action, resourceId]);
  };

  await test("M1 superadmin guard: helper needs another ACTIVE superadmin, takes a lock and is wired everywhere", async () => {
    await q("INSERT INTO user_roles (user_id, role_code) VALUES ($1, 'superadmin')", [ids.director]);
    await q("SELECT app_private.assert_other_active_superadmin($1)", [ids.superadmin]);
    await q("UPDATE users SET status = 'suspended' WHERE id = $1", [ids.director]);
    await expectError("SELECT app_private.assert_other_active_superadmin($1)", [ids.superadmin], "23514");
    await q("SELECT app_private.assert_other_active_superadmin($1)", [ids.director]);
    await q("UPDATE users SET status = 'deletion_pending', deletion_requested_at = now() WHERE id = $1", [ids.director]);
    await expectError("SELECT app_private.assert_other_active_superadmin($1)", [ids.superadmin], "23514");
    // Concurrent calls serialize on the advisory lock, so after it each one sees the other's
    // committed change: the concurrent case reduces to the sequential checks below. The
    // harness runs in one uncommitted transaction, so the wiring is also checked statically.
    const { rows } = await q(`
      SELECT p.oid::regprocedure::text AS fn, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE') AS client_exec
      FROM pg_proc p
      WHERE p.oid IN ('app_private.assert_other_active_superadmin(uuid)'::regprocedure,
        'app_private.protect_last_superadmin()'::regprocedure, 'public.admin_set_user_status(uuid, text)'::regprocedure,
        'public.admin_revoke_role(uuid, text)'::regprocedure, 'public.request_account_deletion()'::regprocedure,
        'app_private.check_profile_territory_active()'::regprocedure, 'app_private.check_selection_active()'::regprocedure)`);
    for (const r of rows) {
      if (r.fn.startsWith("app_private.")) assert(!r.client_exec, `${r.fn} executable by clients`);
      if (r.fn.startsWith("app_private.assert_")) assert(r.prosrc.includes("pg_advisory_xact_lock"), "guard without lock");
      else if (!r.fn.startsWith("app_private.check_")) assert(r.prosrc.includes("assert_other_active_superadmin"), `${r.fn} does not call the guard`);
    }
    assert(rows.length === 7, "guard functions missing");
  });

  await test("M1 superadmin guard: A suspends B, then A cannot request deletion until B is active again", async () => {
    const [A, B] = [ids.superadmin, ids.director];
    await q("INSERT INTO user_roles (user_id, role_code) VALUES ($1, 'superadmin')", [B]);
    await as(A, { aal: "aal2" });
    await q("SELECT public.admin_set_user_status($1, 'suspended')", [B]);
    await as(A);
    await expectError("SELECT public.request_account_deletion()", [], "23514");
    await as(A, { aal: "aal2" });
    await q("SELECT public.admin_set_user_status($1, 'active')", [B]);
    await as(A);
    await q("SELECT public.request_account_deletion()");
    await q("SELECT public.perform_account_deletion()");
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM auth.users WHERE id = $1", [A]) === 0, "deletion with an active substitute failed");
  });

  await test("M1 superadmin guard: no self role changes; revoking or cascading never leaves zero active superadmins", async () => {
    const [A, B] = [ids.superadmin, ids.director];
    await q("INSERT INTO user_roles (user_id, role_code) VALUES ($1, 'superadmin')", [B]);
    await q("UPDATE users SET status = 'suspended' WHERE id = $1", [B]);
    await as(A, { aal: "aal2" });
    await expectError("SELECT public.admin_revoke_role($1, 'superadmin')", [A]);
    await expectError("SELECT public.admin_revoke_role($1, 'docente')", [A]);
    await expectError("SELECT public.admin_grant_role($1, 'admin')", [A]);
    await q("RESET ROLE");
    // Table-level backstop: B exists but is suspended, so A's role cannot go.
    await expectError("DELETE FROM user_roles WHERE user_id = $1 AND role_code = 'superadmin'", [A], "23514");
    await expectError("UPDATE user_roles SET role_code = 'admin' WHERE user_id = $1 AND role_code = 'superadmin'", [A], "23514");
    // A pending-deletion superadmin cannot cascade away the last active one either.
    await q("UPDATE users SET status = 'deletion_pending', deletion_requested_at = now() WHERE id = $1", [A]);
    await expectError("DELETE FROM auth.users WHERE id = $1", [A], "23514");
    await q("UPDATE users SET status = 'active', deletion_requested_at = null WHERE id = $1", [A]);
    await as(A, { aal: "aal2" });
    await q("SELECT public.admin_revoke_role($1, 'superadmin')", [B]);
    assert(await auditCount("user.role_revoked", B) === 1, "revocation not audited");
    await as(A, { aal: "aal2" });
    await q("SELECT public.admin_revoke_role($1, 'superadmin')", [B]);
    assert(await auditCount("user.role_revoked", B) === 1, "no-op revocation audited");
    assert(await count("SELECT 1 FROM user_roles WHERE role_code = 'superadmin'") === 1, "superadmin count wrong");
  });

  await test("B1 roles: grant and revoke validate the role code with 22023", async () => {
    await as(ids.superadmin, { aal: "aal2" });
    await expectError("SELECT public.admin_grant_role($1, 'bogus')", [ids.b], "22023");
    await expectError("SELECT public.admin_grant_role($1, null)", [ids.b], "22023");
    await expectError("SELECT public.admin_revoke_role($1, 'bogus')", [ids.b], "22023");
    await expectError("SELECT public.admin_grant_role($1, 'creador')", [ids.b], "23514");
    await q("SELECT public.admin_revoke_role($1, 'docente')", [ids.b]);
    assert(await auditCount("user.role_revoked", ids.b) === 1, "revocation not audited once");
  });

  await test("M2 catalogs: inactive region, UGEL, level and grade cannot be chosen", async () => {
    await q("UPDATE territory_units SET active = false WHERE official_code IN ('SIN-R02', 'SIN-U02')");
    await q("UPDATE education_catalog SET active = false WHERE code IN ('inicial', 'primaria-3')");
    await as(ids.a);
    await expectError("UPDATE profiles SET country_code = 'PE', region_id = $1", [territory["SIN-R02"]], "23514");
    await expectError("UPDATE profiles SET country_code = 'PE', region_id = $1, ugel_id = $2", [territory["SIN-R01"], territory["SIN-U02"]], "23514");
    assert(await count("UPDATE profiles SET country_code = 'PE', region_id = $1, ugel_id = $2", [territory["SIN-R01"], territory["SIN-U01"]]) === 1, "active territory rejected");
    await expectError("INSERT INTO profile_education_selections (user_id, catalog_id) VALUES ($1, $2)", [ids.a, catalog.inicial], "23514");
    await expectError("SELECT public.save_education_selection($1, false)", [[catalog.inicial]], "23514");
    await expectError("SELECT public.save_education_selection($1, false)", [[catalog.primaria, catalog["primaria-3"]]], "23514");
    await q("SELECT public.save_education_selection($1, false)", [[catalog.primaria, catalog["primaria-1"]]]);
  });

  await test("M2 catalogs: an existing profile keeps inactive choices and can still save other fields", async () => {
    await q("UPDATE profiles SET display_name = 'Ana', country_code = 'PE', region_id = $2, ugel_id = $3, onboarding_step = 3, onboarding_completed_at = now() WHERE user_id = $1", [ids.a, territory["SIN-R02"], territory["SIN-U03"]]);
    await q("INSERT INTO profile_education_selections (user_id, catalog_id) VALUES ($1, $2), ($1, $3)", [ids.a, catalog.primaria, catalog["primaria-3"]]);
    await checkDeferred();
    await q("SET CONSTRAINTS ALL DEFERRED");
    const kept = (await q("SELECT created_at FROM profile_education_selections WHERE user_id = $1 AND catalog_id = $2", [ids.a, catalog["primaria-3"]])).rows[0].created_at;
    await q("UPDATE territory_units SET active = false WHERE official_code IN ('SIN-R02', 'SIN-U03')");
    await q("UPDATE education_catalog SET active = false WHERE code = 'primaria-3'");
    await as(ids.a);
    assert(await count("UPDATE profiles SET display_name = 'Ana María'") === 1, "other fields not saved");
    assert(await count("UPDATE profiles SET region_id = $1, ugel_id = $2", [territory["SIN-R02"], territory["SIN-U03"]]) === 1, "unchanged inactive territory rejected");
    const selected = async () => (await q("SELECT catalog_id FROM profile_education_selections ORDER BY catalog_id")).rows.map((r) => r.catalog_id);
    await q("SELECT public.save_education_selection($1, true)", [[catalog.primaria, catalog["primaria-3"], catalog["primaria-1"]]]);
    await q("SET CONSTRAINTS ALL DEFERRED");
    assert(JSON.stringify(await selected()) === JSON.stringify([catalog.primaria, catalog["primaria-3"], catalog["primaria-1"]].sort()), "inactive selection not kept");
    const after = (await q("SELECT created_at FROM profile_education_selections WHERE catalog_id = $1", [catalog["primaria-3"]])).rows[0].created_at;
    assert(after.getTime() === kept.getTime(), "kept selection was reinserted");
    await q("SELECT public.save_education_selection($1, true)", [[catalog.primaria]]);
    await q("SET CONSTRAINTS ALL DEFERRED");
    assert(JSON.stringify(await selected()) === JSON.stringify([catalog.primaria]), "difference delete failed");
    await expectError("SELECT public.save_education_selection($1, false)", [[catalog.primaria, catalog["primaria-3"]]], "23514");
    await checkDeferred();
  });

  await test("B2-B5: no self-membership; entitlement rows untouched; announcement roles and raw lengths validated", async () => {
    await q("UPDATE module_availability SET required_entitlement = 'demo.access' WHERE module_id = 'biblioteca' AND country_code = 'PE'");
    await asAdmin();
    await expectError("SELECT public.admin_add_org_member($1, 'admin@example.test', 'docente')", [orgB]);
    await expectError("SELECT public.admin_set_module_country('biblioteca', 'PE', false)", [], "23514");
    await q("SELECT public.admin_set_module_country('biblioteca', 'PE', true)");
    const save = (title, body, roles) => q("SELECT public.admin_save_announcement(null, $1, $2, null, null, null, $3, null)", [title, body, roles]);
    for (const roles of [["director"], ["creador"], ["revisor"], ["docente", "bogus"], [null]]) {
      await expectError("SELECT public.admin_save_announcement(null, 't', 'b', null, null, null, $1, null)", [roles], "22023");
    }
    await save("t", "b", ["docente", "admin", "superadmin"]);
    await expectError("SELECT public.admin_save_announcement(null, $1, 'b', null, null, null, null, null)", [`${"x".repeat(119)}  `], "22023");
    await expectError("SELECT public.admin_save_announcement(null, 't', $1, null, null, null, null, null)", [`${"x".repeat(1999)}  `], "22023");
    await save("x".repeat(120), "x".repeat(2000), null);
    await q("RESET ROLE");
    assert(await count("SELECT 1 FROM module_availability WHERE module_id = 'biblioteca' AND country_code = 'PE' AND required_entitlement = 'demo.access'") === 1, "entitlement row changed");
  });

} finally {
  await q("ROLLBACK").catch(() => {});
  await client.end();
}

process.stdout.write(`${results.join("\n")}\n\n${results.length - failed}/${results.length} SQL/RLS checks passed.\n`);
if (failed) process.exit(1);
