import { describe, expect, it } from "vitest";
import {
  billingTotal,
  formatLimaDateTime,
  formatMinorAmount,
  pagerParams,
  paymentListArgs,
  parseBillingFilters,
  subscriptionListArgs,
} from "./facturacion-schemas";

describe("parseBillingFilters", () => {
  it("defaults to the subscriptions tab on page 1", () => {
    expect(parseBillingFilters({})).toEqual({ tab: "suscripciones", status: undefined, plan: undefined, page: 1 });
  });

  it("reads valid subscription filters", () => {
    expect(parseBillingFilters({ tab: "suscripciones", status: "active", plan: "individual", page: "2" })).toEqual({
      tab: "suscripciones",
      status: "active",
      plan: "individual",
      page: 2,
    });
  });

  it("reads valid payment filters and ignores the plan", () => {
    expect(parseBillingFilters({ tab: "pagos", status: "approved", plan: "individual", page: "4" })).toEqual({
      tab: "pagos",
      status: "approved",
      plan: undefined,
      page: 4,
    });
  });

  it("does not accept a status of the other tab", () => {
    expect(parseBillingFilters({ tab: "pagos", status: "active" }).status).toBeUndefined();
    expect(parseBillingFilters({ tab: "suscripciones", status: "approved" }).status).toBeUndefined();
  });

  it("drops invalid values instead of sending them to the database", () => {
    expect(parseBillingFilters({ tab: "otro", status: "x", plan: "gratis", page: "-3" })).toEqual({
      tab: "suscripciones",
      status: undefined,
      plan: undefined,
      page: 1,
    });
  });

  it("takes the first value of repeated parameters", () => {
    expect(parseBillingFilters({ tab: ["pagos", "suscripciones"], status: ["rejected", "approved"] }).status).toBe("rejected");
  });
});

describe("rpc arguments", () => {
  it("maps filters to the function parameters", () => {
    const f = parseBillingFilters({ status: "expired", plan: "institucional", page: "3" });
    expect(subscriptionListArgs(f)).toEqual({ p_status: "expired", p_plan: "institucional", p_page: 3 });
    expect(subscriptionListArgs(parseBillingFilters({}))).toEqual({ p_status: null, p_plan: null, p_page: 1 });
    expect(paymentListArgs(parseBillingFilters({ tab: "pagos", status: "pending" }))).toEqual({ p_status: "pending", p_page: 1 });
  });

  it("keeps the tab and the filters in the pager, without the page", () => {
    expect(pagerParams(parseBillingFilters({ tab: "pagos", status: "approved", page: "2" }))).toEqual({
      tab: "pagos",
      status: "approved",
      plan: undefined,
    });
    expect(pagerParams(parseBillingFilters({ plan: "individual" }))).toEqual({ tab: undefined, status: undefined, plan: "individual" });
  });
});

describe("formatMinorAmount", () => {
  it("formats soles from centimos", () => {
    expect(formatMinorAmount(1990, "PEN")).toBe("S/ 19.90");
    expect(formatMinorAmount(5, "PEN")).toBe("S/ 0.05");
  });

  it("returns a dash for missing or invalid values", () => {
    expect(formatMinorAmount(null, "PEN")).toBe("—");
    expect(formatMinorAmount(1990, null)).toBe("—");
    expect(formatMinorAmount(Number.NaN, "PEN")).toBe("—");
    expect(formatMinorAmount(1990, "peso")).toBe("—");
  });
});

describe("formatLimaDateTime", () => {
  it("uses Lima time (UTC-5)", () => {
    expect(formatLimaDateTime("2026-10-06T03:30:00Z")).toBe("05/10/2026 22:30");
    expect(formatLimaDateTime("2026-10-06T17:05:00Z")).toBe("06/10/2026 12:05");
  });

  it("returns a dash for missing or invalid values", () => {
    expect(formatLimaDateTime(null)).toBe("—");
    expect(formatLimaDateTime("no es fecha")).toBe("—");
  });
});

describe("billingTotal", () => {
  it("reads total_count of the first row, as number or string", () => {
    expect(billingTotal([])).toBe(0);
    expect(billingTotal([{ total_count: 41 }])).toBe(41);
    expect(billingTotal([{ total_count: "7" }])).toBe(7);
    expect(billingTotal([{ total_count: "x" }])).toBe(0);
  });
});
