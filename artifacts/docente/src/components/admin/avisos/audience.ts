import { formatLima } from "../../../core/admin/avisos-dates";
import { adminAvisos } from "../../../i18n/es-admin-avisos";

const t = adminAvisos;

function label(map: Record<string, string>, code: string) {
  return map[code] ?? code;
}

/** One line describing who receives an announcement; an empty group means everyone in that group. */
export function audienceText(countryCodes: readonly string[], roleCodes: readonly string[], planCodes: readonly string[], countryNames: Record<string, string>): string {
  const countries = countryCodes.length > 0 ? countryCodes.map((c) => label(countryNames, c)).join(", ") : t.audienceAllCountries;
  const roles = roleCodes.length > 0 ? roleCodes.map((r) => label(t.roles, r)).join(", ") : t.audienceAllRoles;
  const plans = planCodes.length > 0 ? planCodes.map((p) => label(t.plans, p)).join(", ") : t.audienceAllPlans;
  return t.audienceSummary(countries, roles, plans);
}

/** The validity line of the preview, from ISO instants (or null when empty). */
export function whenText(startIso: string | null, endIso: string | null): string {
  const start = formatLima(startIso);
  const end = formatLima(endIso);
  return start ? t.form.previewWhen(start, end) : t.form.previewWhenNoStart(end);
}
