import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDenied } from "@/components/admin/denied";
import { BarList, EmptyMetric, SignupsTable, Stat, StatGrid } from "@/components/admin/metricas/metric-parts";
import { Notice } from "@/components/cuenta/notice";
import { Section } from "@/components/foundation/page-header";
import { features } from "@/config/features";
import { loadMetrics, type DistributionRow } from "@/core/admin/metricas-queries";
import { distributionLabel, moduleName, toCount, type DistributionDimension } from "@/core/admin/metricas-view";
import { requireAdmin } from "@/core/auth/viewer";
import { admin } from "@/i18n/es-admin";
import { adminMetricas } from "@/i18n/es-admin-metricas";

export const metadata = { title: "Métricas · Administración" };

const t = adminMetricas;

function Failed() {
  return <Notice testId="notice-metric-error">{t.loadError}</Notice>;
}

function DistributionBlock({ dimension, rows }: { dimension: DistributionDimension; rows: DistributionRow[] | null }) {
  return (
    <div className="space-y-3" data-testid={`block-distribution-${dimension}`}>
      <h3 className="text-base font-semibold">{t.distribution[dimension]}</h3>
      {rows === null ? (
        <Failed />
      ) : rows.length === 0 ? (
        <EmptyMetric />
      ) : (
        <BarList
          label={t.distribution[dimension]}
          testId={`list-distribution-${dimension}`}
          valueText={t.distribution.users}
          items={rows.map((r, i) => ({
            key: r.item_id ?? `none-${i}`,
            label: distributionLabel(dimension, r, t.distribution.noRegion),
            value: toCount(r.users),
          }))}
        />
      )}
    </div>
  );
}

export default async function MetricasPage() {
  const { viewer, allowed } = await requireAdmin("admin.metrics.read");
  if (!allowed) {
    return (
      <AdminShell viewer={viewer} section="metricas" title={t.title} lead={admin.denied}>
        <AdminDenied />
      </AdminShell>
    );
  }

  const m = await loadMetrics(features.billing);
  const overview = m.overview.data?.[0];
  const conversion = m.conversion.data?.[0];
  const windows = [1, 7, 30].map((days) => ({
    days,
    users: toCount(m.active.data?.find((w) => Number(w.window_days) === days)?.active_users),
  }));

  return (
    <AdminShell viewer={viewer} section="metricas" title={t.title} lead={t.lead}>
      <p className="text-sm text-muted-foreground" data-testid="text-metrics-scope">
        {t.scopeNote}
      </p>

      <Section title={t.overview.title}>
        {!overview ? (
          <Failed />
        ) : (
          <StatGrid columns="grid-cols-2 lg:grid-cols-4">
            <Stat label={t.overview.total} value={toCount(overview.total_users)} testId="stat-total-users" />
            <Stat label={t.overview.active} value={toCount(overview.active_users)} testId="stat-active-users" />
            <Stat label={t.overview.suspended} value={toCount(overview.suspended_users)} testId="stat-suspended-users" />
            <Stat label={t.overview.onboarded} value={toCount(overview.onboarded_users)} testId="stat-onboarded-users" />
          </StatGrid>
        )}
      </Section>

      <Section title={t.signups.title}>
        <p className="mb-4 text-sm text-muted-foreground">{t.signups.lead}</p>
        {m.signups.data === null ? (
          <Failed />
        ) : (
          <SignupsTable days={m.signups.data.map((d) => ({ day: String(d.day), signups: toCount(d.signups) }))} />
        )}
      </Section>

      <Section title={t.active.title}>
        <p className="mb-4 text-sm text-muted-foreground">{t.active.lead}</p>
        {m.active.data === null ? (
          <Failed />
        ) : (
          <StatGrid columns="grid-cols-1 min-[420px]:grid-cols-3">
            {windows.map((w) => (
              <Stat key={w.days} label={t.active.window(w.days)} value={w.users} testId={`stat-active-${w.days}`} />
            ))}
          </StatGrid>
        )}
      </Section>

      <Section title={t.distribution.title}>
        <p className="mb-1 text-sm text-muted-foreground">{t.distribution.lead}</p>
        <p className="mb-5 text-sm text-muted-foreground">{t.distribution.levelGradeNote}</p>
        <div className="grid gap-8 lg:grid-cols-3">
          <DistributionBlock dimension="region" rows={m.distribution.region.data} />
          <DistributionBlock dimension="level" rows={m.distribution.level.data} />
          <DistributionBlock dimension="grade" rows={m.distribution.grade.data} />
        </div>
      </Section>

      <Section title={t.interest.title}>
        <p className="mb-4 text-sm text-muted-foreground">{t.interest.lead}</p>
        {m.interest.data === null ? (
          <Failed />
        ) : m.interest.data.every((r) => toCount(r.interested) === 0) ? (
          <EmptyMetric />
        ) : (
          <BarList
            label={t.interest.title}
            testId="list-module-interest"
            valueText={t.interest.interested}
            items={m.interest.data.map((r) => ({ key: r.module_id, label: moduleName(r.module_id), value: toCount(r.interested) }))}
          />
        )}
      </Section>

      {features.billing && (
        <Section title={t.conversion.title}>
          <p className="mb-1 text-sm font-medium" data-testid="text-conversion-label">
            {t.conversion.label}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">{t.conversion.lead}</p>
          {!conversion ? (
            <Failed />
          ) : (
            <StatGrid columns="grid-cols-1 min-[420px]:grid-cols-2">
              <Stat label={t.conversion.total} value={toCount(conversion.converted_users)} testId="stat-conversion-total" />
              <Stat label={t.conversion.last30} value={toCount(conversion.converted_last_30_days)} testId="stat-conversion-30" />
            </StatGrid>
          )}
        </Section>
      )}
    </AdminShell>
  );
}
