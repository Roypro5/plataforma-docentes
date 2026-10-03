import { describe, expect, it } from "vitest";
import {
  catalogActiveSchema,
  catalogKinds,
  catalogNameMax,
  catalogParentKind,
  catalogRenameSchema,
  CATALOG_QUERY_MAX,
  parseCatalogFilters,
} from "./catalogos-schemas";

const id = "6f1c7a2e-8d3b-4c51-9a0e-2b7d5e4f3a10";

describe("catalog name limits", () => {
  it("allows 200 characters in territory and 120 in education", () => {
    expect(catalogNameMax("region")).toBe(200);
    expect(catalogNameMax("ugel")).toBe(200);
    expect(catalogNameMax("level")).toBe(120);
    expect(catalogNameMax("grade")).toBe(120);
  });

  it("validates the rename per kind", () => {
    const ok = (kind: string, name: string) => catalogRenameSchema.safeParse({ kind, id, name }).success;
    expect(ok("region", "a".repeat(200))).toBe(true);
    expect(ok("region", "a".repeat(201))).toBe(false);
    expect(ok("grade", "a".repeat(120))).toBe(true);
    expect(ok("grade", "a".repeat(121))).toBe(false);
    expect(ok("level", "   ")).toBe(false);
    expect(ok("ugel", "")).toBe(false);
    expect(catalogRenameSchema.parse({ kind: "level", id, name: "  Primaria  " }).name).toBe("Primaria");
  });

  it("rejects unknown kinds and bad ids", () => {
    expect(catalogRenameSchema.safeParse({ kind: "area", id, name: "x" }).success).toBe(false);
    expect(catalogRenameSchema.safeParse({ kind: "region", id: "1", name: "x" }).success).toBe(false);
  });
});

describe("catalog status change", () => {
  it("reads true and false only", () => {
    expect(catalogActiveSchema.parse({ kind: "region", id, active: "true" }).active).toBe(true);
    expect(catalogActiveSchema.parse({ kind: "region", id, active: "false" }).active).toBe(false);
    expect(catalogActiveSchema.safeParse({ kind: "region", id, active: "yes" }).success).toBe(false);
    expect(catalogActiveSchema.safeParse({ kind: "region", id, active: null }).success).toBe(false);
  });
});

describe("catalog filters", () => {
  it("defaults to regions and page 1", () => {
    expect(parseCatalogFilters({})).toEqual({ kind: "region", q: "", parent: null, page: 1 });
    expect(parseCatalogFilters({ kind: "otro" }).kind).toBe("region");
  });

  it("accepts the four kinds", () => {
    for (const kind of catalogKinds) expect(parseCatalogFilters({ kind }).kind).toBe(kind);
  });

  it("keeps the parent only for kinds that have one and only if it is a uuid", () => {
    expect(parseCatalogFilters({ kind: "ugel", parent: id }).parent).toBe(id);
    expect(parseCatalogFilters({ kind: "grade", parent: id }).parent).toBe(id);
    expect(parseCatalogFilters({ kind: "region", parent: id }).parent).toBeNull();
    expect(parseCatalogFilters({ kind: "level", parent: id }).parent).toBeNull();
    expect(parseCatalogFilters({ kind: "ugel", parent: "x" }).parent).toBeNull();
    expect(catalogParentKind("ugel")).toBe("region");
    expect(catalogParentKind("grade")).toBe("level");
    expect(catalogParentKind("region")).toBeNull();
  });

  it("trims and limits the search text and reads the page", () => {
    expect(parseCatalogFilters({ q: "  Lima  " }).q).toBe("Lima");
    expect(parseCatalogFilters({ q: "a".repeat(300) }).q).toHaveLength(CATALOG_QUERY_MAX);
    expect(parseCatalogFilters({ page: "3" }).page).toBe(3);
    expect(parseCatalogFilters({ page: "-1" }).page).toBe(1);
    expect(parseCatalogFilters({ kind: ["ugel", "grade"] }).kind).toBe("ugel");
  });
});
