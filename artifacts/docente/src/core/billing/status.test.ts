import { describe, expect, it } from "vitest";
import { planes } from "../../i18n/es-planes";
import { PAYMENT_STATUSES } from "./schemas";
import { billingErrorKey, billingErrorMessage, isPaymentOpen, paymentOutcome, paymentStatusLabel, planName } from "./status";

describe("payment outcome", () => {
  it("maps every status to what the result page shows", () => {
    expect(paymentOutcome("approved")).toBe("approved");
    expect(paymentOutcome("pending")).toBe("pending");
    expect(paymentOutcome("rejected")).toBe("retry");
    expect(paymentOutcome("canceled")).toBe("retry");
    expect(paymentOutcome("expired")).toBe("retry");
  });

  it("only a pending payment is open for the sandbox buttons", () => {
    expect(PAYMENT_STATUSES.filter(isPaymentOpen)).toEqual(["pending"]);
  });

  it("has a Spanish label and result text for every status", () => {
    for (const s of PAYMENT_STATUSES) {
      expect(planes.paymentStatus[s]).toBeTruthy();
      expect(planes.resultado.outcome[s].title).toBeTruthy();
    }
    expect(paymentStatusLabel("approved")).toBe("Aprobado");
    expect(paymentStatusLabel("something")).toBe("something");
  });
});

describe("plan names", () => {
  it("names the known plans and falls back to the code", () => {
    expect(planName("gratis")).toBe("Gratis");
    expect(planName("individual")).toBe("Individual");
    expect(planName("otro")).toBe("otro");
  });
});

describe("billing errors", () => {
  it("maps the PostgreSQL codes of the stage 5 functions", () => {
    expect(billingErrorKey("42501")).toBe("denied");
    expect(billingErrorKey("22023")).toBe("invalid");
    expect(billingErrorKey("P0002")).toBe("notFound");
    expect(billingErrorKey("23514")).toBe("conflict");
    expect(billingErrorKey("XX000")).toBe("generic");
    expect(billingErrorKey(undefined)).toBe("generic");
    expect(billingErrorKey(null)).toBe("generic");
  });

  it("explains an existing plan (23514) and a disabled sandbox (42501)", () => {
    expect(billingErrorMessage("23514")).toContain("plan vigente");
    expect(billingErrorMessage("42501")).toContain("no están habilitados");
  });

  it("lets an action give a more specific text", () => {
    expect(billingErrorMessage("23514", { conflict: "otro" })).toBe("otro");
    expect(billingErrorMessage("42501", { conflict: "otro" })).toBe(planes.errors.denied);
  });
});
