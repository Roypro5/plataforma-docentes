import type { ReactNode } from "react";
import { formatDayShort } from "@/core/admin/avisos-dates";
import { barPercent, formatCount, maxOf, sumOf } from "@/core/admin/metricas-view";
import { adminMetricas } from "@/i18n/es-admin-metricas";

const t = adminMetricas;

/** A plain CSS bar. It is decoration: the number next to it carries the data for screen readers. */
export function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="block h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden data-testid="bar">
      <span className="block h-full rounded-full bg-primary" style={{ width: `${barPercent(value, max)}%` }} />
    </span>
  );
}

export function StatGrid({ children, columns }: { children: ReactNode; columns: string }) {
  return <dl className={`grid gap-3 ${columns}`}>{children}</dl>;
}

export function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="rounded-xl border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-display mt-1 text-3xl font-semibold" data-testid={testId}>
        {formatCount(value)}
      </dd>
    </div>
  );
}

export function EmptyMetric({ children = t.none }: { children?: ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground" data-testid="text-metric-empty">
      {children}
    </p>
  );
}

/** Label + number + bar rows. At 360 px the bar goes below the text; nothing scrolls sideways. */
export function BarList({ label, items, valueText, testId }: { label: string; items: { key: string; label: string; value: number }[]; valueText: (n: string) => string; testId: string }) {
  const max = maxOf(items.map((i) => i.value));
  return (
    <ul aria-label={label} className="space-y-3" data-testid={testId}>
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="min-w-0 break-words font-medium">{item.label}</span>
            <span className="text-muted-foreground">{valueText(formatCount(item.value))}</span>
          </div>
          <div className="mt-1.5">
            <Bar value={item.value} max={max} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Daily signups: a table (scrolls inside its container, never the page) with a CSS bar per row. */
export function SignupsTable({ days }: { days: { day: string; signups: number }[] }) {
  const max = maxOf(days.map((d) => d.signups));
  const total = sumOf(days.map((d) => d.signups));
  if (total === 0) return <EmptyMetric />;
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium" data-testid="text-signups-total">
        {t.signups.total(formatCount(total))}
      </p>
      <div className="max-w-full overflow-x-auto rounded-xl border" tabIndex={0} role="region" aria-label={t.signups.caption}>
        <table className="w-full min-w-[18rem] text-sm" data-testid="table-signups">
          <caption className="sr-only">{t.signups.caption}</caption>
          <thead>
            <tr className="border-b bg-muted text-left">
              <th scope="col" className="px-3 py-2 font-semibold">
                {t.signups.day}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                {t.signups.count}
              </th>
              <th scope="col" className="w-full px-3 py-2 font-semibold">
                <span className="sr-only">{t.signups.chart}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-b last:border-b-0" data-testid={`row-signups-${d.day}`}>
                <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-normal">
                  <time dateTime={d.day}>{formatDayShort(d.day)}</time>
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(d.signups)}</td>
                <td className="min-w-20 px-3 py-2">
                  <Bar value={d.signups} max={max} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
