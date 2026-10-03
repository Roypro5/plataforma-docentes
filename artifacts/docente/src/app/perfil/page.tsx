import Link from "next/link";
import { LogOut, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader, Section } from "@/components/foundation/page-header";
import { btnDanger, btnQuiet } from "@/components/cuenta/styles";
import { signOutAction } from "@/core/auth/actions";
import { requireActiveViewer, viewerCan } from "@/core/auth/viewer";
import { loadProfileContext } from "@/core/profile/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { es } from "@/i18n/es";

export const metadata = { title: "Mi cuenta" };

const t = es.cuenta.perfil;
const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeZone: "America/Lima" });

export default async function Perfil() {
  const viewer = await requireActiveViewer();
  const supabase = (await createSupabaseServerClient())!;
  const profile = viewer.profile!;
  const [context, consents] = await Promise.all([
    loadProfileContext(supabase, profile.country_code),
    supabase.from("consent_records").select("document, version, accepted_at").order("accepted_at", { ascending: false }).limit(2),
  ]);
  const nameOf = (id: string | null) => context.territory.find((u) => u.id === id)?.name;
  const education = context.catalog.filter((c) => context.selected.includes(c.id)).map((c) => c.name).join(", ");
  const rows: [string, string | null | undefined][] = [
    [t.fields.displayName, profile.display_name],
    [t.fields.email, viewer.email],
    [t.fields.country, context.countries.find((c) => c.code === profile.country_code)?.name],
    [t.fields.region, nameOf(profile.region_id)],
    [t.fields.ugel, nameOf(profile.ugel_id)],
    [t.fields.institution, profile.institution_name],
    [t.fields.employment, profile.employment_status && es.cuenta.onboarding.employmentOptions[profile.employment_status]],
    [t.fields.education, education],
  ];
  const latestConsent = consents.data?.[0];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={t.lead} crumb={es.nav.cuenta.label} />
      <Section title={profile.display_name ?? t.title} aside={
        <Link href="/bienvenida?paso=1" className={btnQuiet} data-testid="link-edit-profile"><Pencil className="h-4 w-4" aria-hidden />{t.edit}</Link>
      }>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className={`mt-1 break-words text-sm ${value ? "" : "text-muted-foreground"}`}>{value || t.empty}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title={t.consents}>
        <p className="text-sm text-muted-foreground" data-testid="text-consent">
          {latestConsent ? t.consentLine(latestConsent.version, dateFormat.format(new Date(latestConsent.accepted_at))) : t.noConsent}
        </p>
      </Section>
      <div className="flex flex-wrap gap-2">
        {viewerCan(viewer, "admin.access") && (
          <Link href="/admin" className={btnQuiet} data-testid="link-admin"><ShieldCheck className="h-4 w-4" aria-hidden />{t.admin}</Link>
        )}
        <form action={signOutAction}>
          <button type="submit" className={btnQuiet} data-testid="button-sign-out"><LogOut className="h-4 w-4" aria-hidden />{t.signOut}</button>
        </form>
      </div>
      <Section title={t.dangerTitle}>
        <p className="mb-4 text-sm text-muted-foreground">{t.dangerBody}</p>
        <Link href="/perfil/eliminar" className={btnDanger} data-testid="link-delete-account"><Trash2 className="h-4 w-4" aria-hidden />{t.dangerCta}</Link>
      </Section>
    </div>
  );
}
