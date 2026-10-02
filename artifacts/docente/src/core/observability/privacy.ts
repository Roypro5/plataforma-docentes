/**
 * Allowlist telemetry instead of redacting a growing set of sensitive fields.
 * Arbitrary error messages may contain emails, tokens or form contents: do not send them.
 */
export function sanitizeEvent<T extends {
  message?: string;
  exception?: { values?: Array<{ type?: string; value?: string; stacktrace?: unknown }> };
  request?: unknown;
  user?: unknown;
  extra?: unknown;
  contexts?: unknown;
  breadcrumbs?: unknown;
  tags?: unknown;
}>(event: T): T {
  return {
    ...event,
    message: event.message ? "Error de aplicación (contenido omitido)" : undefined,
    exception: event.exception ? {
      values: event.exception.values?.map(() => ({
        type: "ApplicationError",
        value: "Detalle omitido por privacidad",
      })),
    } : undefined,
    request: undefined,
    user: undefined,
    extra: undefined,
    contexts: undefined,
    breadcrumbs: undefined,
    tags: undefined,
  };
}