import { describe, expect, it } from "vitest";
import {
  checkoutPlanSchema,
  historyRowSchema,
  myPlanRowSchema,
  parsePage,
  parsePaymentId,
  parseRows,
  paymentRowSchema,
  planRowSchema,
  resolvePaymentSchema,
  sandboxResultSchema,
  totalPages,
} from "./schemas";

const ID = "3f6c2b9e-8a41-4d3a-9b57-1c2d3e4f5a6b";

describe("payment ids and sandbox results", () => {
  it("accepts a uuid and nothing else", () => {
    expect(parsePaymentId(ID)).toBe(ID);
    expect(parsePaymentId([ID])).toBe(ID);
    expect(parsePaymentId("123")).toBeNull();
    expect(parsePaymentId("")).toBeNull();
    expect(parsePaymentId(undefined)).toBeNull();
    expect(parsePaymentId(null)).toBeNull();
    expect(parsePaymentId(`${ID}; drop table payments`)).toBeNull();
  });

  it("accepts only the four sandbox results", () => {
    for (const r of ["approved", "rejected", "pending", "canceled"]) expect(sandboxResultSchema.safeParse(r).success).toBe(true);
    for (const r of ["expired", "APPROVED", "", "paid"]) expect(sandboxResultSchema.safeParse(r).success).toBe(false);
  });

  it("validates the resolve form as a pair", () => {
    expect(resolvePaymentSchema.safeParse({ pago: ID, resultado: "approved" }).success).toBe(true);
    expect(resolvePaymentSchema.safeParse({ pago: "x", resultado: "approved" }).success).toBe(false);
    expect(resolvePaymentSchema.safeParse({ pago: ID, resultado: "expired" }).success).toBe(false);
    expect(resolvePaymentSchema.safeParse({ pago: ID }).success).toBe(false);
  });

  it("only sells the individual plan", () => {
    expect(checkoutPlanSchema.safeParse("individual").success).toBe(true);
    for (const p of ["gratis", "institucional", ""]) expect(checkoutPlanSchema.safeParse(p).success).toBe(false);
  });
});

describe("paging", () => {
  it("parses page numbers", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2"])).toBe(2);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });

  it("counts pages of 20", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(20)).toBe(1);
    expect(totalPages(21)).toBe(2);
  });
});

describe("rows returned by the database", () => {
  it("parses a plan with a price and a free plan without one", () => {
    const rows = parseRows(planRowSchema, [
      { plan_code: "gratis", scope: "personal", price_id: null, amount_minor: null, currency: null, period: null, entitlement_codes: null, sort_order: 10 },
      { plan_code: "individual", scope: "personal", price_id: ID, amount_minor: 1990, currency: "PEN", period: "month", entitlement_codes: ["demo.access"], sort_order: 20 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows![0].amount_minor).toBeNull();
    expect(rows![0].entitlement_codes).toEqual([]);
    expect(rows![1].amount_minor).toBe(1990);
  });

  it("converts bigint counts that arrive as text", () => {
    const rows = parseRows(historyRowSchema, [
      { id: ID, created_at: "2026-10-06T13:30:00Z", resolved_at: null, status: "pending", amount_minor: 1990, currency: "PEN", plan_code: "individual", provider: "sandbox", total_count: "41" },
    ]);
    expect(rows![0].total_count).toBe(41);
  });

  it("fails closed on an unknown payment status or a malformed row", () => {
    const base = { id: ID, plan_code: "individual", amount_minor: 1990, currency: "PEN", expires_at: null, created_at: "2026-10-06T13:30:00Z", resolved_at: null };
    expect(parseRows(paymentRowSchema, [{ ...base, status: "approved" }])).toHaveLength(1);
    expect(parseRows(paymentRowSchema, [{ ...base, status: "refunded" }])).toBeNull();
    expect(parseRows(paymentRowSchema, [{ ...base, status: "approved", amount_minor: "x" }])).toBeNull();
    expect(parseRows(planRowSchema, "nope")).toBeNull();
  });

  it("treats no rows as an empty list", () => {
    expect(parseRows(planRowSchema, null)).toEqual([]);
  });

  it("parses my_plan with a missing subscription", () => {
    const rows = parseRows(myPlanRowSchema, [
      { plan_code: "gratis", subscription_id: null, status: null, current_period_start: null, current_period_end: null, cancel_at_period_end: false, amount_minor: null, currency: null, pending_payment_id: ID },
    ]);
    expect(rows![0].pending_payment_id).toBe(ID);
    expect(rows![0].cancel_at_period_end).toBe(false);
  });
});
