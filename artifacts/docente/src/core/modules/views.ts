// Relative imports: this file is covered by Vitest, which does not resolve the "@/" alias.
import { getModuleManifest, type ModuleId, type ModuleManifest } from "../../modules/registry";
import { applyEnvironment, type AppEnv, type ModuleAccess } from "./access";

// Row returned by the list_my_modules() RPC.
export type ModuleRow = { module_id: string; access: string; sort_order: number; interested: boolean };

export type ModuleView = {
  id: ModuleId;
  manifest: ModuleManifest;
  access: ModuleAccess;
  interested: boolean;
};

/**
 * Joins the RPC rows with the code manifests. Ids the code does not know are dropped, the
 * environment rule is applied on top of the SQL result, and "hidden" never reaches the UI.
 */
export function resolveModuleViews(rows: readonly ModuleRow[], appEnv: AppEnv): ModuleView[] {
  const views: ModuleView[] = [];
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order || a.module_id.localeCompare(b.module_id));
  for (const row of sorted) {
    const manifest = getModuleManifest(row.module_id);
    if (!manifest) continue;
    const access = applyEnvironment(row.access, manifest, appEnv);
    if (access === "hidden") continue;
    views.push({ id: manifest.id, manifest, access, interested: row.interested === true });
  }
  return views;
}
