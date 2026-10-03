import { admin } from "../../i18n/es-admin";

export type AdminErrorKey = keyof typeof admin.errors;

// PostgreSQL error codes raised by the admin_* functions (docs/architecture/etapa-4-contrato.md).
const byCode: Record<string, AdminErrorKey> = {
  "42501": "denied",
  "22023": "invalid",
  P0002: "notFound",
  "23514": "conflict",
  "23505": "duplicate",
};

export function adminErrorKey(code: string | undefined | null): AdminErrorKey {
  return (code && byCode[code]) || "generic";
}

/** Visible message; a section may give a more specific text for some keys (e.g. conflict). */
export function adminErrorMessage(key: AdminErrorKey, overrides?: Partial<Record<AdminErrorKey, string>>): string {
  return overrides?.[key] ?? admin.errors[key];
}
