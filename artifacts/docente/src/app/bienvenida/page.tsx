import { PageHeader } from "@/components/foundation/page-header";
import { Step1Form, Step2Form, Step3Form } from "@/components/cuenta/onboarding-forms";
import { btnQuiet } from "@/components/cuenta/styles";
import { legal } from "@/config/legal";
import { signOutAction } from "@/core/auth/actions";
import { requireActiveViewer } from "@/core/auth/viewer";
import { hasAcceptedCurrentLegal, loadProfileContext } from "@/core/profile/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { es } from "@/i18n/es";

export const metadata = { title: "Bienvenida" };

const t = es.cuenta.onboarding;

// Three resumable steps: the saved step is the default; ?paso= lets the user go back
// or edit later from the profile, but never skip ahead of what was saved.
export default async function Bienvenida({ searchParams }: { searchParams: Promise<{ paso?: string }> }) {
  const viewer = await requireActiveViewer({ allowIncompleteOnboarding: true });
  const supabase = (await createSupabaseServerClient())!;
  const profile = viewer.profile!;
  const saved = profile.onboarding_completed_at ? 3 : profile.onboarding_step;
  const requested = Number((await searchParams).paso) || saved;
  const step = Math.min(Math.max(requested, 1), saved);
  const [context, legalAccepted] = await Promise.all([
    loadProfileContext(supabase, profile.country_code),
    hasAcceptedCurrentLegal(supabase),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={t.lead} crumb={t.eyebrow} />
      <nav aria-label={t.stepsLabel} className="rise d1">
        <ol className="grid grid-cols-3 gap-2">
          {t.steps.map((label, i) => {
            const n = i + 1;
            return (
              <li key={label} aria-current={n === step ? "step" : undefined}
                className={`rounded-xl border px-3 py-2 text-xs sm:text-sm ${n === step ? "border-primary bg-primary-soft font-semibold text-primary" : n < saved || profile.onboarding_completed_at ? "text-foreground" : "text-muted-foreground"}`}>
                <span className="block font-mono">{n}</span>{label}
              </li>
            );
          })}
        </ol>
      </nav>
      <section aria-labelledby="step-title" className="paper rise d2 max-w-2xl rounded-2xl border p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t.stepOf(step)}</p>
        <h2 id="step-title" className="font-display mb-5 mt-1 text-xl font-semibold">{t.steps[step - 1]}</h2>
        {step === 1 && (
          <Step1Form displayName={profile.display_name ?? ""} countryCode={profile.country_code ?? ""} countries={context.countries}
            legalAccepted={legalAccepted} legalVersion={legal.version} />
        )}
        {step === 2 && (
          <Step2Form territory={context.territory} regionId={profile.region_id ?? ""} ugelId={profile.ugel_id ?? ""}
            institutionName={profile.institution_name ?? ""} employmentStatus={profile.employment_status ?? ""} />
        )}
        {step === 3 && <Step3Form catalog={context.catalog} relations={context.relations} selected={context.selected} />}
      </section>
      {/* /perfil redirects here until onboarding is complete, so sign-out must live here too. */}
      <form action={signOutAction}>
        <button type="submit" className={btnQuiet} data-testid="button-sign-out">{es.cuenta.perfil.signOut}</button>
      </form>
    </div>
  );
}
