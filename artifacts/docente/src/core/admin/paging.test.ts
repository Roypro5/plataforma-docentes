import { describe, expect, it } from "vitest";
import { parsePage, totalPages } from "./paging";

describe("admin paging", () => {
  it("parses page numbers from search params", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "5"])).toBe(2);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage("9999999")).toBe(1);
  });

  it("computes at least one page", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(20)).toBe(1);
    expect(totalPages(21)).toBe(2);
  });
});
