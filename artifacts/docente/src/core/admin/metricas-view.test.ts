import { describe, expect, it } from "vitest";
import { barPercent, distributionLabel, maxOf, moduleName, sumOf, toCount } from "./metricas-view";

describe("bar widths", () => {
  it("scales to the largest value", () => {
    expect(barPercent(50, 100)).toBe(50);
    expect(barPercent(100, 100)).toBe(100);
    expect(barPercent(1, 3)).toBe(33);
  });

  it("gives zero no bar and a positive value at least 2 %", () => {
    expect(barPercent(0, 100)).toBe(0);
    expect(barPercent(1, 1000)).toBe(2);
  });

  it("never divides by zero or goes above 100 %", () => {
    expect(barPercent(5, 0)).toBe(0);
    expect(barPercent(0, 0)).toBe(0);
    expect(barPercent(-3, 10)).toBe(0);
    expect(barPercent(200, 100)).toBe(100);
    expect(barPercent(Number.NaN, 10)).toBe(0);
  });

  it("finds the maximum and the sum", () => {
    expect(maxOf([])).toBe(0);
    expect(maxOf([3, 9, 4])).toBe(9);
    expect(sumOf([])).toBe(0);
    expect(sumOf([3, 9, 4])).toBe(16);
  });
});

describe("counts", () => {
  it("accepts numbers and numeric strings and nothing else", () => {
    expect(toCount(7)).toBe(7);
    expect(toCount("12")).toBe(12);
    expect(toCount(null)).toBe(0);
    expect(toCount(undefined)).toBe(0);
    expect(toCount("abc")).toBe(0);
    expect(toCount(-4)).toBe(0);
  });
});

describe("labels", () => {
  it("names a region without id as 'Sin región'", () => {
    expect(distributionLabel("region", { item_id: null, name: null }, "Sin región")).toBe("Sin región");
    expect(distributionLabel("region", { item_id: "x", name: "Cusco" }, "Sin región")).toBe("Cusco");
    expect(distributionLabel("level", { item_id: "y", name: "Primaria" }, "Sin región")).toBe("Primaria");
  });

  it("resolves module names from the i18n file and falls back to the id", () => {
    expect(moduleName("biblioteca")).toBe("Biblioteca personal");
    expect(moduleName("generador-ia")).toBe("Generador de materiales con IA");
    expect(moduleName("nuevo-modulo")).toBe("nuevo-modulo");
  });
});
