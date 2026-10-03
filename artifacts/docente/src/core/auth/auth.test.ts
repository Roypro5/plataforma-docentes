import { describe, expect, it } from "vitest";
import { can, permissionsFor, roleCodes } from "./permissions";
import { isProtectedPath, safeNextPath } from "./routes";
import { onboardingStep1Schema, onboardingStep2Schema, onboardingStep3Schema, resetSchema, signUpSchema } from "./schemas";

describe("permission matrix", () => {
  it("defines the six approved roles", () => {
    expect(roleCodes.sort()).toEqual(["admin", "creador", "director", "docente", "revisor", "superadmin"]);
  });
  it("denies by default and never grants admin to institutional roles", () => {
    expect(permissionsFor([]).size).toBe(0);
    expect(can(["docente", "director", "creador", "revisor"], "admin.access")).toBe(false);
    expect(can(["unknown"], "org.read")).toBe(false);
  });
  it("reserves privileged role grants for superadmin", () => {
    expect(can(["admin"], "admin.roles.grant_privileged")).toBe(false);
    expect(can(["superadmin"], "admin.roles.grant_privileged")).toBe(true);
  });
});

describe("routes", () => {
  it("protects private sections only", () => {
    expect(isProtectedPath("/perfil")).toBe(true);
    expect(isProtectedPath("/perfil/eliminar")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/perfiles")).toBe(false);
    expect(isProtectedPath("/ingresar")).toBe(false);
  });
  it("rejects open redirects", () => {
    expect(safeNextPath("/bienvenida?paso=2")).toBe("/bienvenida?paso=2");
    for (const bad of ["//evil.test", "https://evil.test", "/\\evil.test", "javascript:alert(1)", undefined, 42]) {
      expect(safeNextPath(bad)).toBe("/perfil");
    }
  });
});

describe("schemas", () => {
  it("normalizes email and requires 8+ character passwords", () => {
    expect(signUpSchema.parse({ email: " Ana@Example.TEST ", password: "12345678" }).email).toBe("ana@example.test");
    expect(signUpSchema.safeParse({ email: "ana@example.test", password: "short" }).success).toBe(false);
    expect(resetSchema.safeParse({ password: "12345678", confirm: "87654321" }).success).toBe(false);
  });
  it("requires name and country in step 1", () => {
    expect(onboardingStep1Schema.safeParse({ displayName: "  ", countryCode: "PE" }).success).toBe(false);
    expect(onboardingStep1Schema.safeParse({ displayName: "Ana", countryCode: "pe" }).success).toBe(false);
  });
  it("keeps step 2 optional and stores empty values as null", () => {
    expect(onboardingStep2Schema.parse({ regionId: "", ugelId: "", institutionName: " ", employmentStatus: "" })).toEqual({
      regionId: null, ugelId: null, institutionName: null, employmentStatus: null,
    });
  });
  it("requires at least one level in step 3", () => {
    expect(onboardingStep3Schema.safeParse({ levels: [], grades: [] }).success).toBe(false);
  });
});
