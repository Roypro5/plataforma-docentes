import { describe, expect, it } from "vitest";
import { admin } from "../../i18n/es-admin";
import { adminErrorKey, adminErrorMessage } from "./errors";

describe("admin error mapping", () => {
  it("maps the contract error codes", () => {
    expect(adminErrorKey("42501")).toBe("denied");
    expect(adminErrorKey("22023")).toBe("invalid");
    expect(adminErrorKey("P0002")).toBe("notFound");
    expect(adminErrorKey("23514")).toBe("conflict");
    expect(adminErrorKey("23505")).toBe("duplicate");
  });

  it("falls back to a generic error", () => {
    expect(adminErrorKey(undefined)).toBe("generic");
    expect(adminErrorKey("08006")).toBe("generic");
  });

  it("lets a section override a message", () => {
    expect(adminErrorMessage("conflict")).toBe(admin.errors.conflict);
    expect(adminErrorMessage("conflict", { conflict: "Otro" })).toBe("Otro");
  });
});
