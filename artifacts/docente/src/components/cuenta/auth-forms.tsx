"use client";

import { useActionState } from "react";
import { recoverAction, resetPasswordAction, signInAction, signUpAction } from "@/core/auth/actions";
import { es } from "@/i18n/es";
import { Field, FormMessage, SubmitButton } from "./form-ui";
import { fieldClass } from "./styles";

const t = es.cuenta;

function EmailField() {
  return (
    <Field id="email" label={t.common.email}>
      <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} className={fieldClass} data-testid="input-email" />
    </Field>
  );
}

function PasswordField({ id = "password", label = t.common.password, autoComplete, hint }: { id?: string; label?: string; autoComplete: string; hint?: string }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <input id={id} name={id} type="password" autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 8 : 1} maxLength={72}
        aria-describedby={hint ? `${id}-hint` : undefined} className={fieldClass} data-testid={`input-${id}`} />
    </Field>
  );
}

export function SignInForm({ next, disabled }: { next: string; disabled: boolean }) {
  const [state, action] = useActionState(signInAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={disabled} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <EmailField />
        <PasswordField autoComplete="current-password" />
        <FormMessage state={state} />
        <SubmitButton testId="button-sign-in">{t.ingresar.submit}</SubmitButton>
      </fieldset>
    </form>
  );
}

export function SignUpForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(signUpAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={disabled || !!state?.ok} className="space-y-4">
        <EmailField />
        <PasswordField autoComplete="new-password" hint={t.common.passwordHint} />
        <FormMessage state={state} />
        <SubmitButton testId="button-sign-up">{t.registro.submit}</SubmitButton>
      </fieldset>
    </form>
  );
}

export function RecoverForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(recoverAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={disabled} className="space-y-4">
        <EmailField />
        <FormMessage state={state} />
        <SubmitButton testId="button-recover">{t.recuperar.submit}</SubmitButton>
      </fieldset>
    </form>
  );
}

export function ResetForm({ needsMfa }: { needsMfa: boolean }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <PasswordField autoComplete="new-password" hint={t.common.passwordHint} />
      <PasswordField id="confirm" label={t.restablecer.confirm} autoComplete="new-password" />
      {needsMfa && (
        <Field id="code" label={t.restablecer.mfaCode} hint={t.restablecer.mfaHint}>
          <input id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
            aria-describedby="code-hint" className={fieldClass} data-testid="input-reset-totp" />
        </Field>
      )}
      <FormMessage state={state} />
      <SubmitButton testId="button-reset-password">{t.restablecer.submit}</SubmitButton>
    </form>
  );
}
