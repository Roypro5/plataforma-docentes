"use client";

import { useActionState, useMemo, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/cuenta/form-ui";
import { fieldClass } from "@/components/cuenta/styles";
import { limaInputToIso } from "@/core/admin/avisos-dates";
import { announcementPlans, announcementRoles, BODY_MAX, TITLE_MAX } from "@/core/admin/avisos-schemas";
import { saveAnnouncementAction } from "@/core/admin/avisos-actions";
import { adminAvisos } from "@/i18n/es-admin-avisos";
import { AnnouncementPreview } from "./announcement-preview";
import { audienceText, whenText } from "./audience";

const t = adminAvisos;

export type AnnouncementFormValues = {
  id: string | null;
  title: string;
  body: string;
  /** datetime-local values in Lima time ("" when empty) */
  startsAt: string;
  endsAt: string;
  countries: string[];
  roles: string[];
  plans: string[];
};

function toggle(list: string[], value: string, on: boolean) {
  return on ? [...list.filter((v) => v !== value), value] : list.filter((v) => v !== value);
}

function CheckGroup({
  legend,
  name,
  options,
  selected,
  onChange,
  empty,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (value: string, on: boolean) => void;
  empty?: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium">{legend}</legend>
      {options.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((o) => (
            <label key={o.value} className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
              <input
                type="checkbox"
                name={name}
                value={o.value}
                checked={selected.includes(o.value)}
                onChange={(e) => onChange(o.value, e.target.checked)}
                className="h-5 w-5 shrink-0 accent-[hsl(var(--primary))]"
                data-testid={`check-${name}-${o.value}`}
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

// Controlled fields: after a server error the form keeps what was typed, and the preview updates live.
export function AnnouncementForm({ initial, countries }: { initial: AnnouncementFormValues; countries: { code: string; name: string }[] }) {
  const [state, formAction] = useActionState(saveAnnouncementAction, undefined);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [selCountries, setSelCountries] = useState(initial.countries);
  const [selRoles, setSelRoles] = useState(initial.roles);
  const [selPlans, setSelPlans] = useState(initial.plans);

  const countryNames = useMemo(() => Object.fromEntries(countries.map((c) => [c.code, c.name])), [countries]);
  // Codes already stored on the announcement stay selectable even if the country is no longer active.
  const countryOptions = useMemo(() => {
    const known = new Set(countries.map((c) => c.code));
    return [...countries.map((c) => ({ value: c.code, label: c.name })), ...initial.countries.filter((c) => !known.has(c)).map((c) => ({ value: c, label: c }))];
  }, [countries, initial.countries]);

  const when = whenText(startsAt ? limaInputToIso(startsAt) : null, endsAt ? limaInputToIso(endsAt) : null);

  return (
    <div className="space-y-6">
      <form action={formAction} className="paper space-y-5 rounded-2xl border p-5 sm:p-6" data-testid="form-announcement" noValidate>
        {initial.id && <input type="hidden" name="id" value={initial.id} />}

        <Field id="announcement-title" label={t.form.titleLabel} hint={t.form.titleHint(TITLE_MAX)}>
          <input
            id="announcement-title"
            name="title"
            type="text"
            required
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-describedby="announcement-title-hint"
            className={fieldClass}
            data-testid="input-announcement-title"
          />
        </Field>

        <Field id="announcement-body" label={t.form.bodyLabel} hint={t.form.bodyHint(BODY_MAX)}>
          <textarea
            id="announcement-body"
            name="body"
            required
            maxLength={BODY_MAX}
            rows={7}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-describedby="announcement-body-hint announcement-body-count"
            className={`${fieldClass} min-h-40 py-3 leading-relaxed`}
            data-testid="input-announcement-body"
          />
        </Field>
        <p id="announcement-body-count" className="-mt-3 text-sm text-muted-foreground" data-testid="text-body-count">
          {t.form.counter(body.length, BODY_MAX)}
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="announcement-starts" label={t.form.startsLabel} hint={t.form.startsHint}>
            <input
              id="announcement-starts"
              name="startsAt"
              type="datetime-local"
              step={60}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              aria-describedby="announcement-starts-hint"
              className={fieldClass}
              data-testid="input-announcement-starts"
            />
          </Field>
          <Field id="announcement-ends" label={t.form.endsLabel} hint={t.form.endsHint}>
            <input
              id="announcement-ends"
              name="endsAt"
              type="datetime-local"
              step={60}
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              aria-describedby="announcement-ends-hint"
              className={fieldClass}
              data-testid="input-announcement-ends"
            />
          </Field>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">{t.form.audienceTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.form.audienceHint}</p>
          </div>
          <CheckGroup
            legend={t.form.countriesLegend}
            name="countries"
            options={countryOptions}
            selected={selCountries}
            onChange={(v, on) => setSelCountries((l) => toggle(l, v, on))}
            empty={t.form.noCountries}
          />
          <CheckGroup
            legend={t.form.rolesLegend}
            name="roles"
            options={announcementRoles.map((r) => ({ value: r, label: t.roles[r] }))}
            selected={selRoles}
            onChange={(v, on) => setSelRoles((l) => toggle(l, v, on))}
          />
          <CheckGroup
            legend={t.form.plansLegend}
            name="plans"
            options={announcementPlans.map((p) => ({ value: p, label: t.plans[p] }))}
            selected={selPlans}
            onChange={(v, on) => setSelPlans((l) => toggle(l, v, on))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton testId="button-announcement-save">{initial.id ? t.form.save : t.form.saveNew}</SubmitButton>
        </div>
        <FormMessage state={state} />
      </form>

      <AnnouncementPreview title={title} body={body} when={when} audience={audienceText(selCountries, selRoles, selPlans, countryNames)} />
    </div>
  );
}
