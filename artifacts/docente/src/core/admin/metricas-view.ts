import { modulos } from "../../i18n/es-modulos";

// Pure helpers for the metrics page (tested without the server).

/** PostgREST returns bigint as a number, but accept strings too; anything else counts as 0. */
export function toCount(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Width of a bar, 0–100, relative to the largest value. A positive value never gets a bar thinner
 * than 2 % (it would be invisible); zero gets none. The number next to the bar is the real data.
 */
export function barPercent(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.min(100, Math.max(2, Math.round((value / max) * 100)));
}

export function maxOf(values: readonly number[]): number {
  return values.reduce((m, v) => (v > m ? v : m), 0);
}

export function sumOf(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

/** Display name of a module: from the i18n file, or the raw id for a module the code does not know. */
export function moduleName(id: string): string {
  const items = modulos.items as Record<string, { name: string } | undefined>;
  return items[id]?.name ?? id;
}

export type DistributionDimension = "region" | "level" | "grade";

export function distributionLabel(dimension: DistributionDimension, row: { item_id: string | null; name: string | null }, noRegion: string): string {
  if (row.item_id === null && dimension === "region") return noRegion;
  return row.name ?? "";
}

const COUNT = new Intl.NumberFormat("es-PE");
export function formatCount(n: number): string {
  return COUNT.format(n);
}
