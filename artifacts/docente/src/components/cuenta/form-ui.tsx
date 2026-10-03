"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { es } from "@/i18n/es";
import { btnPrimary, type FormState } from "./styles";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SubmitButton({ children, className = btnPrimary, testId }: { children: ReactNode; className?: string; testId?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={className} data-testid={testId}>
      {pending ? es.cuenta.common.sending : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  return (
    <div role="status" aria-live="polite" data-testid="status-form">
      {state?.error && (
        <p className="flex gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{state.error}
        </p>
      )}
      {state?.ok && (
        <p className="flex gap-2 rounded-xl bg-primary-soft p-3 text-sm text-primary">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{state.ok}
        </p>
      )}
    </div>
  );
}
