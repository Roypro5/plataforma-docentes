"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "@/core/account/actions";
import { es } from "@/i18n/es";
import { Field, FormMessage, SubmitButton } from "./form-ui";
import { btnDanger, fieldClass } from "./styles";

const t = es.cuenta.eliminar;

export function DeleteAccountForm({ retry = false }: { retry?: boolean }) {
  const [state, action] = useActionState(deleteAccountAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {!retry && (
        <Field id="confirm" label={t.confirmLabel}>
          <input id="confirm" name="confirm" required autoComplete="off" autoCapitalize="characters" className={fieldClass} data-testid="input-delete-confirm" />
        </Field>
      )}
      <FormMessage state={state} />
      <SubmitButton className={btnDanger} testId="button-delete-account">{retry ? t.retry : t.submit}</SubmitButton>
    </form>
  );
}
