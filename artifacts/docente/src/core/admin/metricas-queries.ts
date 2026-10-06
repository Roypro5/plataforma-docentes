import "server-only";
import type { Permission } from "@/core/auth/permissions";
import { adminCall } from "./rpc";
import type { DistributionDimension } from "./metricas-view";

const PERMISSION = "admin.metrics.read" as const;

export type Overview = { total_users: number | string; active_users: number | string; suspended_users: number | string; onboarded_users: number | string };
export type SignupDay = { day: string; signups: number | string };
export type ActiveWindow = { window_days: number; active_users: number | string };
export type DistributionRow = { item_id: string | null; name: string | null; users: number | string };
export type InterestRow = { module_id: string; interested: number | string };
export type ConversionRow = { converted_users: number | string; converted_last_30_days: number | string };

/** `data` is null when the function failed; the page then shows an error for that block only. */
export type Block<T> = { data: T | null };

async function block<T>(fn: string, args?: Record<string, unknown>, permission: Permission = PERMISSION): Promise<Block<T>> {
  const result = await adminCall<T>(permission, fn, args);
  return { data: result.ok ? result.data : null };
}

/** `withConversion` is the billing feature: without it the sandbox conversion is neither queried nor shown. */
export async function loadMetrics(withConversion: boolean) {
  const [overview, signups, active, region, level, grade, interest, conversion] = await Promise.all([
    block<Overview[]>("admin_metric_overview"),
    block<SignupDay[]>("admin_metric_signups", { p_days: 30 }),
    block<ActiveWindow[]>("admin_metric_active_users"),
    distribution("region"),
    distribution("level"),
    distribution("grade"),
    block<InterestRow[]>("admin_metric_module_interest"),
    // Conversion reads sandbox billing data, so the database requires admin.billing.read.
    withConversion
      ? block<ConversionRow[]>("admin_metric_conversion", undefined, "admin.billing.read")
      : Promise.resolve<Block<ConversionRow[]>>({ data: null }),
  ]);
  return { overview, signups, active, distribution: { region, level, grade }, interest, conversion };
}

function distribution(dimension: DistributionDimension) {
  return block<DistributionRow[]>("admin_metric_distribution", { p_dimension: dimension });
}
