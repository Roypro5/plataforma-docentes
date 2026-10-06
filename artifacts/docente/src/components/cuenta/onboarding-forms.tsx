"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveStep1Action, saveStep2Action, saveStep3Action } from "@/core/profile/actions";
import type { CatalogItem, TerritoryItem } from "@/core/profile/queries";
import { es } from "@/i18n/es";
import { Field, FormMessage, SubmitButton } from "./form-ui";
import { btnQuiet, fieldClass } from "./styles";

const t = es.cuenta.onboarding;

export function Step1Form({ displayName, countryCode, countries, legalAccepted, legalVersion }: {
  displayName: string; countryCode: string; countries: { code: string; name: string }[]; legalAccepted: boolean; legalVersion: string;
}) {
  const [state, action] = useActionState(saveStep1Action, undefined);
  return (
    <form action={action} className="space-y-5">
      <Field id="displayName" label={t.displayName}>
        <input id="displayName" name="displayName" required maxLength={120} autoComplete="name" defaultValue={displayName} className={fieldClass} data-testid="input-display-name" />
      </Field>
      <Field id="countryCode" label={t.country} hint={countries.length ? undefined : t.noCountries}>
        <select id="countryCode" name="countryCode" required defaultValue={countryCode || countries[0]?.code} className={fieldClass} data-testid="select-country">
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </Field>
      {legalAccepted ? (
        <p className="text-sm text-muted-foreground">{t.legalAccepted}</p>
      ) : (
        <div className="flex gap-3">
          <input id="acceptLegal" name="acceptLegal" type="checkbox" required className="mt-1 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" data-testid="checkbox-legal" />
          <label htmlFor="acceptLegal" className="text-sm leading-relaxed">
            {t.legal(legalVersion)}{" "}
            <Link href="/legal" className="text-primary underline underline-offset-4">{t.legalLink}</Link>
          </label>
        </div>
      )}
      <FormMessage state={state} />
      <SubmitButton testId="button-step1">{t.next}</SubmitButton>
    </form>
  );
}

export function Step2Form({ territory, regionId, ugelId, institutionName, employmentStatus }: {
  territory: TerritoryItem[]; regionId: string; ugelId: string; institutionName: string; employmentStatus: string;
}) {
  const [state, action] = useActionState(saveStep2Action, undefined);
  const [region, setRegion] = useState(regionId);
  const regions = territory.filter((u) => u.kind === "region");
  const ugels = territory.filter((u) => u.kind === "ugel" && u.parent_id === region);
  // Without territory data (production has none until the official list is imported) there is
  // nothing to pick: the fields are not rendered and the server leaves the saved values alone.
  const hasTerritory = regions.length > 0;
  return (
    <form action={action} className="space-y-5">
      {hasTerritory && territory.some((u) => u.is_synthetic) && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t.syntheticNotice}</p>}
      {hasTerritory && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="regionId" label={t.region}>
            <select id="regionId" name="regionId" value={region} onChange={(e) => setRegion(e.target.value)} className={fieldClass} data-testid="select-region">
              <option value="">{t.none}</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field id="ugelId" label={t.ugel}>
            <select id="ugelId" name="ugelId" key={region} defaultValue={region === regionId ? ugelId : ""} disabled={!region} className={fieldClass} data-testid="select-ugel">
              <option value="">{region ? t.none : t.chooseRegionFirst}</option>
              {ugels.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
      )}
      <Field id="institutionName" label={t.institution} hint={t.institutionHint}>
        <input id="institutionName" name="institutionName" maxLength={200} defaultValue={institutionName} aria-describedby="institutionName-hint" className={fieldClass} data-testid="input-institution" />
      </Field>
      <Field id="employmentStatus" label={t.employment}>
        <select id="employmentStatus" name="employmentStatus" defaultValue={employmentStatus} className={fieldClass} data-testid="select-employment">
          <option value="">{t.none}</option>
          {Object.entries(t.employmentOptions).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </Field>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton testId="button-step2">{t.next}</SubmitButton>
        <button type="submit" name="intent" value="skip" formNoValidate className={btnQuiet} data-testid="button-step2-skip">{t.skip}</button>
        <Link href="/bienvenida?paso=1" className={btnQuiet}>{t.previous}</Link>
      </div>
    </form>
  );
}

export function Step3Form({ catalog, relations, selected }: {
  catalog: CatalogItem[]; relations: { from_id: string; to_id: string }[]; selected: string[];
}) {
  const [state, action] = useActionState(saveStep3Action, undefined);
  const levels = catalog.filter((c) => c.kind === "level");
  const [chosen, setChosen] = useState(() => new Set(selected.filter((id) => levels.some((l) => l.id === id))));
  const grades = useMemo(() => {
    const allowed = new Set(relations.filter((r) => chosen.has(r.from_id)).map((r) => r.to_id));
    return catalog.filter((c) => c.kind === "grade" && allowed.has(c.id));
  }, [catalog, relations, chosen]);
  const toggle = (id: string) => setChosen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <form action={action} className="space-y-6">
      <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t.catalogNotice}</p>
      <fieldset>
        <legend className="text-sm font-medium">{t.levels}</legend>
        <p className="mt-1 text-sm text-muted-foreground">{t.levelsHint}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {levels.map((l) => (
            <label key={l.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
              <input type="checkbox" name="levels" value={l.id} checked={chosen.has(l.id)} onChange={() => toggle(l.id)} className="h-5 w-5 accent-[hsl(var(--primary))]" data-testid={`checkbox-level-${l.name}`} />
              <span className="text-sm font-medium">{l.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {grades.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium">{t.grades}</legend>
          <p className="mt-1 text-sm text-muted-foreground">{t.gradesHint}</p>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
            {grades.map((g) => (
              <label key={g.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input type="checkbox" name="grades" value={g.id} defaultChecked={selected.includes(g.id)} className="h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />
                <span className="text-sm">{g.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="text-sm text-muted-foreground">{t.areasPending}</p>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton testId="button-step3">{t.finish}</SubmitButton>
        <Link href="/bienvenida?paso=2" className={btnQuiet}>{t.previous}</Link>
      </div>
    </form>
  );
}
