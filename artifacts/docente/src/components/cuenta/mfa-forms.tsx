"use client";

import { useActionState } from "react";
import { startTotpEnrollAction, verifyTotpAction } from "@/core/auth/mfa-actions";
import { es } from "@/i18n/es";
import { Field, FormMessage, SubmitButton } from "./form-ui";
import { fieldClass } from "./styles";

const t = es.cuenta.admin;

export function VerifyTotpForm({ factorId }: { factorId: string }) {
  const [state, action] = useActionState(verifyTotpAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="factorId" value={factorId} />
      <Field id="code" label={t.code}>
        <input id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className={fieldClass} data-testid="input-totp" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton testId="button-verify-totp">{t.verify}</SubmitButton>
    </form>
  );
}

export function EnrollTotp() {
  const [state, start] = useActionState(startTotpEnrollAction, undefined);
  if (state && "factorId" in state) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">{t.enrollIntro}</p>
        {/* Supabase returns the QR as an SVG data URL generated server-side. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.qr} alt={t.qrAlt} width={200} height={200} className="rounded-xl border bg-white p-2" />
        <p className="text-sm">
          <span className="font-medium">{t.secret}: </span>
          <code className="break-all rounded bg-muted px-1.5 py-0.5" data-testid="text-totp-secret">{state.secret}</code>
        </p>
        <VerifyTotpForm factorId={state.factorId} />
      </div>
    );
  }
  return (
    <form action={start} className="space-y-4">
      <FormMessage state={state && "error" in state ? state : undefined} />
      <SubmitButton testId="button-enroll-totp">{t.startEnroll}</SubmitButton>
    </form>
  );
}
