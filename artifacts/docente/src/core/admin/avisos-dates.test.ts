import { describe, expect, it } from "vitest";
import { formatDayShort, formatLima, isoToLimaInput, limaInputToIso } from "./avisos-dates";

describe("Lima date conversion", () => {
  it("turns a datetime-local value into ISO with the -05:00 offset", () => {
    expect(limaInputToIso("2026-10-05T08:30")).toBe("2026-10-05T08:30:00-05:00");
    expect(limaInputToIso("2026-12-31T23:59")).toBe("2026-12-31T23:59:00-05:00");
    expect(limaInputToIso("2026-10-05T08:30:15")).toBe("2026-10-05T08:30:00-05:00");
  });

  it("is the same instant as the UTC time five hours later", () => {
    expect(Date.parse(limaInputToIso("2026-10-05T19:00")!)).toBe(Date.parse("2026-10-06T00:00:00Z"));
  });

  it("rejects text that is not a real date", () => {
    expect(limaInputToIso("")).toBeNull();
    expect(limaInputToIso("mañana")).toBeNull();
    expect(limaInputToIso("2026-02-30T10:00")).toBeNull();
    expect(limaInputToIso("2026-13-01T10:00")).toBeNull();
    expect(limaInputToIso("2026-10-05T24:00")).toBeNull();
    expect(limaInputToIso("2026-10-05 08:30")).toBeNull();
    expect(limaInputToIso("2026-10-05T08:30:00-05:00")).toBeNull();
  });

  it("accepts a leap day only in leap years", () => {
    expect(limaInputToIso("2028-02-29T10:00")).toBe("2028-02-29T10:00:00-05:00");
    expect(limaInputToIso("2026-02-29T10:00")).toBeNull();
  });

  it("converts an instant back to Lima time for the form", () => {
    expect(isoToLimaInput("2026-10-06T00:00:00Z")).toBe("2026-10-05T19:00");
    expect(isoToLimaInput("2026-10-05T13:30:00+00:00")).toBe("2026-10-05T08:30");
    expect(isoToLimaInput("2026-01-01T03:00:00.123456+00:00")).toBe("2025-12-31T22:00");
  });

  it("round-trips through the form", () => {
    const iso = limaInputToIso("2026-10-05T08:30")!;
    expect(isoToLimaInput(iso)).toBe("2026-10-05T08:30");
  });

  it("returns an empty string for missing or invalid instants", () => {
    expect(isoToLimaInput(null)).toBe("");
    expect(isoToLimaInput(undefined)).toBe("");
    expect(isoToLimaInput("no es fecha")).toBe("");
  });

  it("formats an instant for reading", () => {
    expect(formatLima("2026-10-05T13:30:00Z")).toBe("5 oct 2026, 08:30");
    expect(formatLima(null)).toBe("");
  });

  it("formats a plain day", () => {
    expect(formatDayShort("2026-10-03")).toBe("3 oct");
    expect(formatDayShort("2026-01-15")).toBe("15 ene");
    expect(formatDayShort("raro")).toBe("raro");
  });
});
