import type { Permission } from "@/core/auth/permissions";

// The seven sections of /admin and the permission each page requires.
export const adminSections = [
  { key: "usuarios", href: "/admin/usuarios", permission: "admin.users.read" },
  { key: "modulos", href: "/admin/modulos", permission: "admin.modules.manage" },
  { key: "avisos", href: "/admin/avisos", permission: "admin.announcements.manage" },
  { key: "catalogos", href: "/admin/catalogos", permission: "admin.catalogs.manage" },
  { key: "organizaciones", href: "/admin/organizaciones", permission: "admin.orgs.manage" },
  { key: "metricas", href: "/admin/metricas", permission: "admin.metrics.read" },
  { key: "auditoria", href: "/admin/auditoria", permission: "admin.audit.read" },
] as const satisfies readonly { key: string; href: string; permission: Permission }[];

export type AdminSectionKey = (typeof adminSections)[number]["key"];
