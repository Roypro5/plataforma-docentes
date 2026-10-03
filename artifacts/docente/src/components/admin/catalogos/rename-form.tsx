"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/cuenta/form-ui";
import { btnPrimary, fieldClass } from "@/components/cuenta/styles";
import { renameCatalogItemAction } from "@/core/admin/catalogos-actions";
import { adminCatalogos } from "@/i18n/es-admin-catalogos";

const t = adminCatalogos.rename;

export function RenameForm({ kind, id, name, max }: { kind: string; id: string; name: string; max: number }) {
  const [state, formAction] = useActionState(renameCatalogItemAction, undefined);
  const inputId = `rename-${id}`;
  return (
    <details className="group" data-testid={`details-rename-${id}`}>
      <summary
        aria-label={t.summaryFor(name)}
        className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-xl border px-4 text-sm font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        data-testid={`button-rename-${id}`}
      >
        {t.summary}
      </summary>
      <form action={formAction} className="mt-3 space-y-3" noValidate>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <Field id={inputId} label={t.label} hint={t.hint(max)}>
          <input
            id={inputId}
            name="name"
            type="text"
            required
            maxLength={max}
            defaultValue={name}
            aria-describedby={`${inputId}-hint`}
            className={fieldClass}
            data-testid={`input-rename-${id}`}
          />
        </Field>
        <SubmitButton className={btnPrimary} testId={`button-rename-save-${id}`}>
          {t.submit}
        </SubmitButton>
        <FormMessage state={state} />
      </form>
    </details>
  );
}
