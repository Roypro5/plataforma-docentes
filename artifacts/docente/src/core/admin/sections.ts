import type { Permission } from "@/core/auth/permissions";
import { features, type AppFeatures } from "../../config/features";

// The sections of /admin and the permission each page requires.
const allAdminSections = [
  { key: "usuarios", href: "/admin/usuarios", permission: "admin.users.read" },
  { key: "modulos", href: "/admin/modulos", permission: "admin.modules.manage" },
  { key: "avisos", href: "/admin/avisos", permission: "admin.announcements.manage" },
  { key: "catalogos", href: "/admin/catalogos", permission: "admin.catalogs.manage" },
  { key: "organizaciones", href: "/admin/organizaciones", permission: "admin.orgs.manage" },
  { key: "metricas", href: "/admin/metricas", permission: "admin.metrics.read" },
  { key: "auditoria", href: "/admin/auditoria", permission: "admin.audit.read" },
  { key: "planes-pagos", href: "/admin/planes-pagos", permission: "admin.billing.read" },
] as const satisfies readonly { key: string; href: string; permission: Permission }[];

export type AdminSectionKey = (typeof allAdminSections)[number]["key"];

/** Billing sections exist only while the billing feature is on (not in production). */
export function adminSectionsFor(f: Pick<AppFeatures, "billing">) {
  return allAdminSections.filter((s) => f.billing || s.key !== "planes-pagos");
}

export const adminSections = adminSectionsFor(features);
