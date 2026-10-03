import { describe, expect, it } from "vitest";
import {
  EMAIL_MAX,
  firstOrgError,
  isMemberRole,
  isOrgStatus,
  ORG_NAME_MAX,
  orgCreateSchema,
  orgMemberAddSchema,
  orgMemberRemoveSchema,
  orgStatusSchema,
} from "./organizaciones-schemas";

const id = "6f1c7a2e-8d3b-4c51-9a0e-2b7d5e4f3a10";
const other = "0a5b9c2d-1e3f-4a6b-8c7d-9e0f1a2b3c4d";

function errorOf(result: { success: boolean; error?: import("zod").ZodError }) {
  return result.success ? null : firstOrgError(result.error!);
}

describe("test organization schemas", () => {
  it("validates the name length and the country", () => {
    expect(orgCreateSchema.parse({ name: "  Colegio de prueba  ", country: "PE" })).toEqual({ name: "Colegio de prueba", country: "PE" });
    expect(errorOf(orgCreateSchema.safeParse({ name: "   ", country: "PE" }))).toBe("name");
    expect(errorOf(orgCreateSchema.safeParse({ name: "a".repeat(ORG_NAME_MAX + 1), country: "PE" }))).toBe("name");
    expect(orgCreateSchema.safeParse({ name: "a".repeat(ORG_NAME_MAX), country: "PE" }).success).toBe(true);
    expect(errorOf(orgCreateSchema.safeParse({ name: "Colegio", country: "pe" }))).toBe("country");
    expect(errorOf(orgCreateSchema.safeParse({ name: "Colegio", country: "" }))).toBe("country");
  });

  it("accepts only active and inactive as status", () => {
    expect(orgStatusSchema.safeParse({ org: id, status: "active" }).success).toBe(true);
    expect(orgStatusSchema.safeParse({ org: id, status: "inactive" }).success).toBe(true);
    expect(orgStatusSchema.safeParse({ org: id, status: "deleted" }).success).toBe(false);
    expect(orgStatusSchema.safeParse({ org: "x", status: "active" }).success).toBe(false);
    expect(isOrgStatus("active")).toBe(true);
    expect(isOrgStatus("otro")).toBe(false);
  });

  it("normalises the member email and limits the roles to docente and director", () => {
    const ok = orgMemberAddSchema.parse({ org: id, email: "  Ana.Perez@Example.com ", role: "director" });
    expect(ok.email).toBe("ana.perez@example.com");
    expect(ok.role).toBe("director");
    expect(errorOf(orgMemberAddSchema.safeParse({ org: id, email: "sin-arroba", role: "docente" }))).toBe("email");
    expect(errorOf(orgMemberAddSchema.safeParse({ org: id, email: "", role: "docente" }))).toBe("email");
    expect(errorOf(orgMemberAddSchema.safeParse({ org: id, email: `${"a".repeat(EMAIL_MAX)}@x.pe`, role: "docente" }))).toBe("email");
    expect(errorOf(orgMemberAddSchema.safeParse({ org: id, email: "a@b.pe", role: "admin" }))).toBe("role");
    expect(isMemberRole("docente")).toBe(true);
    expect(isMemberRole("superadmin")).toBe(false);
  });

  it("needs two uuids to remove a member", () => {
    expect(orgMemberRemoveSchema.safeParse({ org: id, user: other }).success).toBe(true);
    expect(orgMemberRemoveSchema.safeParse({ org: id, user: "x" }).success).toBe(false);
    expect(orgMemberRemoveSchema.safeParse({ org: id }).success).toBe(false);
  });
});
