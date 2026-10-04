import { describe, expect, it } from "vitest";
import { formatDateLima, formatDateTimeLima, formatMinor, formatPrice } from "./format";

describe("formatMinor", () => {
  it("shows soles with two decimals", () => {
    expect(formatMinor(1990, "PEN")).toBe("S/ 19.90");
    expect(formatMinor(100, "PEN")).toBe("S/ 1.00");
    expect(formatMinor(5, "PEN")).toBe("S/ 0.05");
    expect(formatMinor(0, "PEN")).toBe("S/ 0.00");
  });

  it("groups thousands with a comma", () => {
    expect(formatMinor(123456, "PEN")).toBe("S/ 1,234.56");
    expect(formatMinor(100000000, "PEN")).toBe("S/ 1,000,000.00");
  });

  it("uses a known symbol or falls back to the currency code", () => {
    expect(formatMinor(1990, "USD")).toBe("US$ 19.90");
    expect(formatMinor(1990, "clp")).toBe("CLP 19.90");
  });

  it("never invents an amount from a value that is not an integer", () => {
    expect(formatMinor(19.9, "PEN")).toBe("—");
    expect(formatMinor(Number.NaN, "PEN")).toBe("—");
    expect(formatMinor(Number.POSITIVE_INFINITY, "PEN")).toBe("—");
  });
});

describe("formatPrice", () => {
  it("adds the period", () => {
    expect(formatPrice(1990, "PEN", "month")).toBe("S/ 19.90 al mes");
  });

  it("omits an unknown or missing period", () => {
    expect(formatPrice(1990, "PEN")).toBe("S/ 19.90");
    expect(formatPrice(1990, "PEN", null)).toBe("S/ 19.90");
    expect(formatPrice(1990, "PEN", "year")).toBe("S/ 19.90");
  });
});

describe("Lima dates", () => {
  it("shows date and time in Lima time (UTC-5)", () => {
    expect(formatDateTimeLima("2026-10-06T13:30:00Z")).toBe("6 oct 2026, 08:30");
  });

  it("changes the day when UTC is already the next day but Lima is not", () => {
    expect(formatDateLima("2026-11-04T02:00:00Z")).toBe("3 nov 2026");
    expect(formatDateLima("2026-11-04T05:00:00Z")).toBe("4 nov 2026");
  });

  it("returns an empty string for anything that is not a date", () => {
    expect(formatDateLima(null)).toBe("");
    expect(formatDateLima(undefined)).toBe("");
    expect(formatDateLima("ayer")).toBe("");
    expect(formatDateTimeLima("")).toBe("");
  });
});
