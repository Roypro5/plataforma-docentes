import { describe, expect, it } from "vitest";
import { resolveAppEnv, type AppEnv } from "../core/modules/access";
import { appFeatures, isBillingPath } from "./features";

describe("appFeatures", () => {
  it("hides billing, internal pages and stage information in production", () => {
    expect(appFeatures("production")).toEqual({ billing: false, internalPages: false, stageInfo: false });
  });

  it("keeps every project feature in development and staging", () => {
    for (const env of ["development", "staging"] as AppEnv[]) {
      expect(appFeatures(env)).toEqual({ billing: true, internalPages: true, stageInfo: true });
    }
  });

  it("resolves an unset or unknown environment to the production features (fail closed)", () => {
    for (const raw of [undefined, null, "", "preview", "Production ", "STAGING"]) {
      expect(appFeatures(resolveAppEnv(raw))).toEqual(appFeatures("production"));
    }
    expect(appFeatures(resolveAppEnv("staging")).billing).toBe(true);
  });
});

describe("isBillingPath", () => {
  it("matches the billing pages and their children", () => {
    for (const path of [
      "/planes",
      "/planes/checkout",
      "/planes/resultado",
      "/planes/sandbox/3f2b1c0e",
      "/mi-plan",
      "/admin/planes-pagos",
    ]) {
      expect(isBillingPath(path), path).toBe(true);
    }
  });

  it("ignores lookalikes and unrelated pages", () => {
    for (const path of ["/", "/planeso", "/mi-plan-b", "/admin", "/admin/metricas", "/panel", "/perfil"]) {
      expect(isBillingPath(path), path).toBe(false);
    }
  });
});
