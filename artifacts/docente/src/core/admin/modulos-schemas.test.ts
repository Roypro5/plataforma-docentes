import { describe, expect, it } from "vitest";
import {
  countryLabels,
  isCountryEnabled,
  moduleCountrySchema,
  moduleEmergencySchema,
  moduleName,
  moduleStatusSchema,
  statusOptions,
} from "./modulos-schemas";

describe("module action schemas", () => {
  it("accepts the three statuses and rejects anything else", () => {
    for (const status of ["hidden", "coming_soon", "active"]) {
      expect(moduleStatusSchema.safeParse({ module: "biblioteca", status }).success).toBe(true);
    }
    expect(moduleStatusSchema.safeParse({ module: "biblioteca", status: "disabled" }).success).toBe(false);
  });

  it("never lets the demo module through", () => {
    expect(moduleStatusSchema.safeParse({ module: "demo", status: "hidden" }).success).toBe(false);
    expect(moduleEmergencySchema.safeParse({ module: "demo", disabled: "true" }).success).toBe(false);
    expect(moduleCountrySchema.safeParse({ module: "demo", country: "PE", enabled: "true" }).success).toBe(false);
  });

  it("validates module ids as slugs", () => {
    expect(moduleStatusSchema.safeParse({ module: "cursos-simulacros", status: "hidden" }).success).toBe(true);
    expect(moduleStatusSchema.safeParse({ module: "Cursos Simulacros", status: "hidden" }).success).toBe(false);
    expect(moduleStatusSchema.safeParse({ module: "", status: "hidden" }).success).toBe(false);
    expect(moduleStatusSchema.safeParse({ module: "../x", status: "hidden" }).success).toBe(false);
  });

  it("turns the emergency and enabled flags into booleans", () => {
    expect(moduleEmergencySchema.parse({ module: "marketplace", disabled: "true" }).disabled).toBe(true);
    expect(moduleEmergencySchema.parse({ module: "marketplace", disabled: "false" }).disabled).toBe(false);
    expect(moduleEmergencySchema.safeParse({ module: "marketplace", disabled: "yes" }).success).toBe(false);
    expect(moduleCountrySchema.parse({ module: "marketplace", country: "PE", enabled: "false" })).toEqual({
      module: "marketplace",
      country: "PE",
      enabled: false,
    });
  });

  it("requires a two-letter uppercase country code", () => {
    for (const country of ["pe", "PER", "P", "", "P1"]) {
      expect(moduleCountrySchema.safeParse({ module: "marketplace", country, enabled: "true" }).success).toBe(false);
    }
  });
});

describe("module helpers", () => {
  it("offers active only when the module is implemented", () => {
    expect(statusOptions({ implementation_available: false })).toEqual(["hidden", "coming_soon"]);
    expect(statusOptions({ implementation_available: true })).toEqual(["hidden", "coming_soon", "active"]);
  });

  it("uses the i18n name and falls back to the id", () => {
    expect(moduleName("biblioteca")).toBe("Biblioteca personal");
    expect(moduleName("modulo-nuevo")).toBe("modulo-nuevo");
    expect(moduleName("constructor")).toBe("constructor");
  });

  it("reads the countries of a module", () => {
    expect(isCountryEnabled({ country_codes: ["PE"] }, "PE")).toBe(true);
    expect(isCountryEnabled({ country_codes: null }, "PE")).toBe(false);
    expect(countryLabels(["PE", "CL"], [{ code: "PE", name: "Perú" }])).toEqual(["Perú (PE)", "CL"]);
    expect(countryLabels(null, [])).toEqual([]);
  });
});
