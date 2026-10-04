import "server-only";
import { adminCall, type AdminResult } from "./rpc";
import {
  billingTotal,
  paymentListArgs,
  subscriptionListArgs,
  type BillingFilters,
  type PaymentRow,
  type SubscriptionRow,
} from "./facturacion-schemas";

const PERMISSION = "admin.billing.read" as const;

export type BillingList<T> = { rows: T[]; total: number };

/** One page of `admin_list_subscriptions`. The database audits the listing. */
export async function listSubscriptions(filters: BillingFilters): Promise<AdminResult<BillingList<SubscriptionRow>>> {
  const res = await adminCall<SubscriptionRow[] | null>(PERMISSION, "admin_list_subscriptions", subscriptionListArgs(filters));
  if (!res.ok) return res;
  const rows = res.data ?? [];
  return { ok: true, data: { rows, total: billingTotal(rows) } };
}

/** One page of `admin_list_payments`. The database audits the listing. */
export async function listPayments(filters: BillingFilters): Promise<AdminResult<BillingList<PaymentRow>>> {
  const res = await adminCall<PaymentRow[] | null>(PERMISSION, "admin_list_payments", paymentListArgs(filters));
  if (!res.ok) return res;
  const rows = res.data ?? [];
  return { ok: true, data: { rows, total: billingTotal(rows) } };
}
