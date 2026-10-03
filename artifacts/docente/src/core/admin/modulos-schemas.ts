import { z } from "zod";
import { modulos } from "../../i18n/es-modulos";

// Pure helpers of /admin/modulos: action schemas and the options each module offers.

export const MODULE_STATUSES = ["hidden", "coming_soon", "active"] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

/** The demo module is managed only by the migration and the seed; the panel never touches it. */
export const PROTECTED_MODULE = "demo";

export type ModuleRow = {
  module_id: string;
  status: ModuleStatus;
  implementation_available: boolean;
  emergency_disabled: boolean;
  sort_order: number;
  country_codes: string[] | null;
  interest_count: number | string;
  updated_at: string;
};

export type Country = { code: string; name: string };

const moduleId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
  .refine((id) => id !== PROTECTED_MODULE);

const boolText = z.enum(["true", "false"]).transform((v) => v === "true");

export const moduleStatusSchema = z.object({ module: moduleId, status: z.enum(MODULE_STATUSES) });
export const moduleEmergencySchema = z.object({ module: moduleId, disabled: boolText });
export const moduleCountrySchema = z.object({ module: moduleId, country: z.string().regex(/^[A-Z]{2}$/), enabled: boolText });

/** `active` is offered only when the code implements the module (the database also rejects it). */
export function statusOptions(row: Pick<ModuleRow, "implementation_available">): ModuleStatus[] {
  return MODULE_STATUSES.filter((s) => s !== "active" || row.implementation_available);
}

/** Visible module name from the i18n file; an id the code does not know is shown as is. */
export function moduleName(id: string): string {
  return Object.hasOwn(modulos.items, id) ? modulos.items[id as keyof typeof modulos.items].name : id;
}

export function isCountryEnabled(row: Pick<ModuleRow, "country_codes">, code: string): boolean {
  return (row.country_codes ?? []).includes(code);
}

/** "Perú (PE)" using the active countries; an unknown code is shown alone. */
export function countryLabels(codes: readonly string[] | null, countries: readonly Country[]): string[] {
  const names = new Map(countries.map((c) => [c.code, c.name]));
  return (codes ?? []).map((code) => {
    const name = names.get(code);
    return name ? `${name} (${code})` : code;
  });
}
