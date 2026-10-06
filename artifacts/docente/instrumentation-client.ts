import * as Sentry from "@sentry/nextjs";
import { sanitizeEvent } from "./src/core/observability/privacy";
import { resolveAppEnv } from "./src/core/modules/access";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Same rule as the app: unset or unknown counts as production.
    environment: resolveAppEnv(process.env.NEXT_PUBLIC_APP_ENV),
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, databaseQueryData: false, queues: false },
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: sanitizeEvent,
    beforeBreadcrumb: () => null,
  });
}
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;