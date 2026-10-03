import { Library, Sparkles, Store, FlaskConical, GraduationCap, type LucideIcon } from "lucide-react";

// Module manifests. The visible state of each module (hidden, coming soon, active…) lives in
// the database and is resolved by SQL (app_private.module_access); the manifest only holds what
// the code owns: the stable id, the icon and whether the module may exist in production.
// Visible texts live in src/i18n/es-modulos.ts.
export const moduleIds = ["generador-ia", "biblioteca", "marketplace", "cursos-simulacros", "demo"] as const;

export type ModuleId = (typeof moduleIds)[number];

export type ModuleManifest = {
  readonly id: ModuleId;
  readonly icon: LucideIcon;
  /** Only exists in development and staging; production never shows nor allows it. */
  readonly devOnly: boolean;
};

export const moduleManifests: readonly ModuleManifest[] = [
  { id: "generador-ia", icon: Sparkles, devOnly: false },
  { id: "biblioteca", icon: Library, devOnly: false },
  { id: "marketplace", icon: Store, devOnly: false },
  { id: "cursos-simulacros", icon: GraduationCap, devOnly: false },
  { id: "demo", icon: FlaskConical, devOnly: true },
];

const byId = new Map<string, ModuleManifest>(moduleManifests.map((m) => [m.id, m]));

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === "string" && byId.has(value);
}

/** Returns the manifest for an id, or undefined for ids the code does not know. */
export function getModuleManifest(id: string): ModuleManifest | undefined {
  return byId.get(id);
}
