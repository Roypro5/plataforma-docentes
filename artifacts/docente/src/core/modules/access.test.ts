import { describe, expect, it } from "vitest";
import { applyEnvironment, resolveAppEnv, type AppEnv, type ModuleAccess } from "./access";
import { getModuleManifest, isModuleId, moduleManifests } from "../../modules/registry";

const states: ModuleAccess[] = ["coming_soon", "available", "requires_entitlement", "disabled"];
const envs: AppEnv[] = ["development", "staging", "production"];

describe("applyEnvironment", () => {
  it("never changes a regular module, in any environment", () => {
    for (const env of envs) {
      for (const access of states) {
        expect(applyEnvironment(access, { devOnly: false }, env)).toBe(access);
      }
    }
  });

  it("hides dev-only modules in production for every state", () => {
    for (const access of states) {
      expect(applyEnvironment(access, { devOnly: true }, "production")).toBe("hidden");
    }
  });

  it("keeps dev-only modules in development and staging", () => {
    for (const env of ["development", "staging"] as const) {
      for (const access of states) {
        expect(applyEnvironment(access, { devOnly: true }, env)).toBe(access);
      }
    }
  });

  it("fails closed on unknown access strings, including 'hidden' and empty", () => {
    for (const env of envs) {
      for (const devOnly of [true, false]) {
        for (const access of ["hidden", "active", "", "AVAILABLE", "unknown", "null"]) {
          expect(applyEnvironment(access, { devOnly }, env)).toBe("hidden");
        }
      }
    }
  });
});

describe("resolveAppEnv", () => {
  it("accepts the known environments", () => {
    expect(resolveAppEnv("development")).toBe("development");
    expect(resolveAppEnv("staging")).toBe("staging");
    expect(resolveAppEnv("production")).toBe("production");
  });
  it("treats unset or unknown values as production", () => {
    expect(resolveAppEnv(undefined)).toBe("production");
    expect(resolveAppEnv(null)).toBe("production");
    expect(resolveAppEnv("")).toBe("production");
    expect(resolveAppEnv("preview")).toBe("production");
  });
});

describe("module registry", () => {
  it("declares the five approved modules and only demo is dev-only", () => {
    expect(moduleManifests.map((m) => m.id)).toEqual(["generador-ia", "biblioteca", "marketplace", "cursos-simulacros", "demo"]);
    expect(moduleManifests.filter((m) => m.devOnly).map((m) => m.id)).toEqual(["demo"]);
  });
  it("looks modules up by id and rejects unknown ids", () => {
    expect(getModuleManifest("demo")?.devOnly).toBe(true);
    expect(getModuleManifest("biblioteca")?.devOnly).toBe(false);
    expect(getModuleManifest("otro")).toBeUndefined();
    expect(isModuleId("marketplace")).toBe(true);
    expect(isModuleId("toString")).toBe(false);
    expect(isModuleId(42)).toBe(false);
  });
  it("gives every module an icon", () => {
    for (const m of moduleManifests) expect(m.icon).toBeTruthy();
  });
});
