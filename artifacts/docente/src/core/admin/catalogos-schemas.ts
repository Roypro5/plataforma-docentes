import { z } from "zod";
import { parsePage } from "./paging";

export const catalogKinds = ["region", "ugel", "level", "grade"] as const;
export type CatalogKind = (typeof catalogKinds)[number];

export const TERRITORY_NAME_MAX = 200;
export const EDUCATION_NAME_MAX = 120;
export const CATALOG_QUERY_MAX = 100;

export function isCatalogKind(value: unknown): value is CatalogKind {
  return typeof value === "string" && (catalogKinds as readonly string[]).includes(value);
}

/** Regions and UGEL live in territory_units (200 characters); levels and grades in education_catalog (120). */
export function catalogNameMax(kind: CatalogKind): number {
  return kind === "region" || kind === "ugel" ? TERRITORY_NAME_MAX : EDUCATION_NAME_MAX;
}

/** The kind whose items filter this one: UGEL by region, grades by level. Regions and levels have no parent. */
export function catalogParentKind(kind: CatalogKind): "region" | "level" | null {
  if (kind === "ugel") return "region";
  if (kind === "grade") return "level";
  return null;
}

const idSchema = z.string().uuid();
const kindSchema = z.enum(catalogKinds);

export const catalogRenameSchema = z
  .object({ kind: kindSchema, id: idSchema, name: z.string().trim() })
  .superRefine((value, ctx) => {
    const max = catalogNameMax(value.kind);
    if (value.name.length < 1 || value.name.length > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: "name" });
    }
  });

export const catalogActiveSchema = z.object({
  kind: kindSchema,
  id: idSchema,
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export type CatalogFilters = { kind: CatalogKind; q: string; parent: string | null; page: number };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads ?kind, ?q, ?parent and ?page; anything invalid falls back to a safe default. */
export function parseCatalogFilters(query: Record<string, string | string[] | undefined>): CatalogFilters {
  const rawKind = first(query.kind);
  const kind: CatalogKind = isCatalogKind(rawKind) ? rawKind : "region";
  const q = (first(query.q) ?? "").trim().slice(0, CATALOG_QUERY_MAX);
  const rawParent = first(query.parent);
  const parent = catalogParentKind(kind) && rawParent && idSchema.safeParse(rawParent).success ? rawParent : null;
  return { kind, q, parent, page: parsePage(query.page) };
}
