import { parsePage } from "./paging";

// Pure helpers of /admin/planes-pagos: query-string parsing, RPC arguments, row types and
// formatting. The section is read-only; the database repeats every rule.

export const BILLING_TABS = ["suscripciones", "pagos"] as const;
export type BillingTab = (typeof BILLING_TABS)[number];

export const SUBSCRIPTION_STATUSES = ["incomplete", "active", "expired", "incomplete_expired"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "approved", "rejected", "canceled", "expired"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Plans that can hold a subscription. Gratis never has one. */
export const SUBSCRIPTION_PLANS = ["individual", "institucional"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(allowed: readonly T[], value: string | undefined): T | undefined {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export type BillingFilters = {
  tab: BillingTab;
  /** Status of the subscription or of the payment, depending on the tab. */
  status?: string;
  /** Only on the subscriptions tab. */
  plan?: SubscriptionPlan;
  page: number;
};

/** Reads `?tab=&status=&plan=&page=`; anything invalid is dropped instead of reaching the database. */
export function parseBillingFilters(raw: RawParams): BillingFilters {
  const tab = oneOf(BILLING_TABS, first(raw.tab)) ?? "suscripciones";
  const status = first(raw.status);
  if (tab === "pagos") {
    return { tab, status: oneOf(PAYMENT_STATUSES, status), plan: undefined, page: parsePage(raw.page) };
  }
  return { tab, status: oneOf(SUBSCRIPTION_STATUSES, status), plan: oneOf(SUBSCRIPTION_PLANS, first(raw.plan)), page: parsePage(raw.page) };
}

/** Arguments of `admin_list_subscriptions`. */
export function subscriptionListArgs(f: BillingFilters) {
  return { p_status: f.status ?? null, p_plan: f.plan ?? null, p_page: f.page };
}

/** Arguments of `admin_list_payments`. */
export function paymentListArgs(f: BillingFilters) {
  return { p_status: f.status ?? null, p_page: f.page };
}

/** Query-string parameters the pager must keep (without `page`). */
export function pagerParams(f: BillingFilters): Record<string, string | undefined> {
  return { tab: f.tab === "suscripciones" ? undefined : f.tab, status: f.status, plan: f.plan };
}

export type SubscriptionRow = {
  id: string;
  user_id: string;
  email: string | null;
  plan_code: string;
  status: SubscriptionStatus;
  is_current: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  amount_minor: number | null;
  currency: string | null;
  created_at: string;
  activated_at: string | null;
  total_count: number | string;
};

export type PaymentRow = {
  id: string;
  subscription_id: string;
  user_id: string;
  email: string | null;
  amount_minor: number;
  currency: string;
  provider: string;
  status: PaymentStatus;
  provider_reference: string | null;
  created_at: string;
  resolved_at: string | null;
  expires_at: string | null;
  total_count: number | string;
};

const limaDateTime = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** dd/mm/aaaa hh:mm in Lima time; "—" for a missing or invalid value. */
export function formatLimaDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const p = Object.fromEntries(limaDateTime.formatToParts(d).map((part) => [part.type, part.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/**
 * Amount in minor units (centimos) as money, e.g. 1990 PEN -> "S/ 19.90". Not-a-number or a
 * currency code that is not three letters gives "—" instead of inventing a value.
 */
export function formatMinorAmount(amountMinor: number | null | undefined, currency: string | null | undefined): string {
  if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor) || !currency || !/^[A-Z]{3}$/.test(currency)) return "—";
  try {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(amountMinor / 100).replace(/ /g, " ");
  } catch {
    return "—";
  }
}

export function billingTotal(rows: readonly { total_count: number | string }[]): number {
  if (rows.length === 0) return 0;
  const n = Number(rows[0].total_count);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
