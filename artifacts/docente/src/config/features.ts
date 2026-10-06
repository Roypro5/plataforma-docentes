import { resolveAppEnv, type AppEnv } from "../core/modules/access";

/**
 * What the product shows in each environment. This is the only place that decides it: pages,
 * navigation and server gates read these flags instead of comparing the environment themselves.
 *
 * - billing: plans, checkout, sandbox gateway, Mi plan and the billing parts of the admin panel.
 *   Production has no payments (everyone is on Gratis), so it hides all of it.
 * - internalPages: project pages ("Sistema visual", "Hoja de ruta") and their navigation.
 * - stageInfo: everything that talks about the project, not the product: the stage badge, the
 *   stage status on the home page and the "test environment, no real data" notices.
 */
export type AppFeatures = {
  readonly billing: boolean;
  readonly internalPages: boolean;
  readonly stageInfo: boolean;
};

const production: AppFeatures = { billing: false, internalPages: false, stageInfo: false };
const nonProduction: AppFeatures = { billing: true, internalPages: true, stageInfo: true };

/** Production is fail-closed: an unset or unknown NEXT_PUBLIC_APP_ENV resolves to it (see resolveAppEnv). */
export function appFeatures(env: AppEnv): AppFeatures {
  return env === "production" ? production : nonProduction;
}

/** Paths that exist only while `billing` is on. */
const billingPrefixes = ["/planes", "/mi-plan", "/admin/planes-pagos"] as const;

function matchesPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** True for the pages that must answer 404 when `billing` is off. */
export function isBillingPath(path: string) {
  return billingPrefixes.some((prefix) => matchesPrefix(path, prefix));
}

/**
 * NEXT_PUBLIC_APP_ENV is inlined at build time, in server and browser bundles alike, so the
 * shell (a client component) and the server pages always agree on the same mode.
 */
export const features: AppFeatures = appFeatures(resolveAppEnv(process.env.NEXT_PUBLIC_APP_ENV));
