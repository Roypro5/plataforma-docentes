import * as Sentry from "@sentry/nextjs";
import { sanitizeEvent } from "./src/core/observability/privacy";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, databaseQueryData: false, queues: false },
    tracesSampleRate: 0,
    beforeSend: sanitizeEvent,
    beforeBreadcrumb: () => null,
  });
}