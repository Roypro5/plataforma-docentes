"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/cuenta/form-ui";
import { fieldClass } from "@/components/cuenta/styles";
import { createTestOrgAction } from "@/core/admin/organizaciones-actions";
import { ORG_NAME_MAX } from "@/core/admin/organizaciones-schemas";
import { adminOrgs } from "@/i18n/es-admin-organizaciones";

const t = adminOrgs.create;

export function CreateOrgForm({ countries }: { countries: { code: string; name: string }[] }) {
  const [state, formAction] = useActionState(createTestOrgAction, undefined);
  const [name, setName] = useState("");
  const [country, setCountry] = useState(countries[0]?.code ?? "");

  return (
    <form action={formAction} className="space-y-4" data-testid="form-org-create" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <Field id="org-name" label={t.nameLabel} hint={t.nameHint(ORG_NAME_MAX)}>
          <input
            id="org-name"
            name="name"
            type="text"
            required
            maxLength={ORG_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-describedby="org-name-hint"
            className={fieldClass}
            data-testid="input-org-name"
          />
        </Field>
        <Field id="org-country" label={t.countryLabel} hint={countries.length === 0 ? t.countryEmpty : undefined}>
          <select
            id="org-country"
            name="country"
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={fieldClass}
            data-testid="select-org-country"
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <SubmitButton testId="button-org-create">{t.submit}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
