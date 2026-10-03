import "server-only";
import { adminCall } from "./rpc";
import type { DistributionDimension } from "./metricas-view";

const PERMISSION = "admin.metrics.read" as const;

export type Overview = { total_users: number | string; active_users: number | string; suspended_users: number | string; onboarded_users: number | string };
export type SignupDay = { day: string; signups: number | string };
export type ActiveWindow = { window_days: number; active_users: number | string };
export type DistributionRow = { item_id: string | null; name: string | null; users: number | string };
export type InterestRow = { module_id: string; interested: number | string };

/** `data` is null when the function failed; the page then shows an error for that block only. */
export type Block<T> = { data: T | null };

async function block<T>(fn: string, args?: Record<string, unknown>): Promise<Block<T>> {
  const result = await adminCall<T>(PERMISSION, fn, args);
  return { data: result.ok ? result.data : null };
}

export async function loadMetrics() {
  const [overview, signups, active, region, level, grade, interest] = await Promise.all([
    block<Overview[]>("admin_metric_overview"),
    block<SignupDay[]>("admin_metric_signups", { p_days: 30 }),
    block<ActiveWindow[]>("admin_metric_active_users"),
    distribution("region"),
    distribution("level"),
    distribution("grade"),
    block<InterestRow[]>("admin_metric_module_interest"),
  ]);
  return { overview, signups, active, distribution: { region, level, grade }, interest };
}

function distribution(dimension: DistributionDimension) {
  return block<DistributionRow[]>("admin_metric_distribution", { p_dimension: dimension });
}
