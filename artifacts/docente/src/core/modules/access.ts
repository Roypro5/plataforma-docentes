import type { ModuleManifest } from "@/modules/registry";

// The access state of a module is computed by SQL (app_private.module_access) and read via RPC.
// The app only adds what the database does not know: the environment.
export type ModuleAccess = "coming_soon" | "available" | "requires_entitlement" | "disabled";

export type AppEnv = "development" | "staging" | "production";

const visibleStates: readonly ModuleAccess[] = ["coming_soon", "available", "requires_entitlement", "disabled"];

function isModuleAccess(value: unknown): value is ModuleAccess {
  return typeof value === "string" && (visibleStates as readonly string[]).includes(value);
}

/**
 * Normalizes NEXT_PUBLIC_APP_ENV. Anything unset or unknown counts as production, so a missing
 * variable can never expose dev-only modules.
 */
export function resolveAppEnv(value: string | undefined | null): AppEnv {
  return value === "development" || value === "staging" ? value : "production";
}

/**
 * Applies the environment rule on top of the SQL result. Dev-only modules are hidden in
 * production; any access string the app does not recognize also resolves to "hidden" (fail closed).
 */
export function applyEnvironment(
  access: string,
  manifest: Pick<ModuleManifest, "devOnly">,
  appEnv: AppEnv,
): ModuleAccess | "hidden" {
  if (!isModuleAccess(access)) return "hidden";
  if (manifest.devOnly && appEnv === "production") return "hidden";
  return access;
}
