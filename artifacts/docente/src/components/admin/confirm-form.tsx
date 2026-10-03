"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormMessage } from "@/components/cuenta/form-ui";
import { btnQuiet, type FormState } from "@/components/cuenta/styles";
import { admin } from "@/i18n/es-admin";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/**
 * A button that submits a Server Action, optionally after confirming in an accessible dialog
 * (`confirmTitle`; use it for destructive actions). `fields` become hidden inputs and `children`
 * may add visible inputs. The result is announced below the button.
 */
export function ConfirmForm({
  action,
  fields,
  label,
  confirmTitle,
  confirmBody,
  confirmLabel = admin.confirm.confirm,
  className = btnQuiet,
  testId,
  children,
}: {
  action: Action;
  fields: Record<string, string>;
  label: ReactNode;
  confirmTitle?: string;
  confirmBody?: string;
  confirmLabel?: string;
  className?: string;
  testId?: string;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      {confirmTitle ? (
        <>
          <button type="button" className={className} disabled={pending} onClick={() => setOpen(true)} data-testid={testId}>
            {label}
          </button>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
                {confirmBody && <AlertDialogDescription>{confirmBody}</AlertDialogDescription>}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11" data-testid={testId && `${testId}-cancel`}>
                  {admin.confirm.cancel}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="min-h-11"
                  onClick={() => formRef.current?.requestSubmit()}
                  data-testid={testId && `${testId}-confirm`}
                >
                  {confirmLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <button type="submit" className={className} disabled={pending} data-testid={testId}>
          {label}
        </button>
      )}
      <FormMessage state={state} />
    </form>
  );
}
