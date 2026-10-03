"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/cuenta/form-ui";
import { fieldClass } from "@/components/cuenta/styles";
import { addOrgMemberAction } from "@/core/admin/organizaciones-actions";
import { EMAIL_MAX, memberRoles } from "@/core/admin/organizaciones-schemas";
import { adminOrgs } from "@/i18n/es-admin-organizaciones";

const t = adminOrgs;

export function AddMemberForm({ orgId }: { orgId: string }) {
  const [state, formAction] = useActionState(addOrgMemberAction, undefined);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(memberRoles[0]);

  return (
    <form action={formAction} className="space-y-4" data-testid="form-org-member-add" noValidate>
      <input type="hidden" name="org" value={orgId} />
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <Field id="member-email" label={t.add.emailLabel} hint={t.add.emailHint}>
          <input
            id="member-email"
            name="email"
            type="email"
            required
            maxLength={EMAIL_MAX}
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby="member-email-hint"
            className={fieldClass}
            data-testid="input-member-email"
          />
        </Field>
        <Field id="member-role" label={t.add.roleLabel}>
          <select id="member-role" name="role" value={role} onChange={(e) => setRole(e.target.value)} className={fieldClass} data-testid="select-member-role">
            {memberRoles.map((r) => (
              <option key={r} value={r}>
                {t.members.roles[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <SubmitButton testId="button-member-add">{t.add.submit}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
