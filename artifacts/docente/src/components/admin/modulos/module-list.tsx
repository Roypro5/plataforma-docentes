import { ConfirmForm } from "@/components/admin/confirm-form";
import { btnDanger, btnQuiet, fieldClass } from "@/components/cuenta/styles";
import { setModuleCountryAction, setModuleEmergencyAction, setModuleStatusAction } from "@/core/admin/modulos-actions";
import {
  countryLabels,
  isCountryEnabled,
  moduleName,
  statusOptions,
  type Country,
  type ModuleRow,
} from "@/core/admin/modulos-schemas";
import { adminModulos } from "@/i18n/es-admin-modulos";

const t = adminModulos;

// Visible text plus a longer name for screen readers, so repeated buttons say which module they affect.
function ButtonLabel({ visible, full }: { visible: string; full: string }) {
  return (
    <>
      <span aria-hidden>{visible}</span>
      <span className="sr-only">{full}</span>
    </>
  );
}

function ModuleCard({ row, countries }: { row: ModuleRow; countries: Country[] }) {
  const id = row.module_id;
  const name = moduleName(id);
  const enabledIn = countryLabels(row.country_codes, countries);
  const options = statusOptions(row);

  return (
    <li className="paper space-y-4 rounded-2xl border p-4 sm:p-5" data-testid={`row-module-${id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{name}</h3>
          <p className="break-all text-xs text-muted-foreground">{id}</p>
        </div>
        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary" data-testid={`text-module-status-${id}`}>
          {t.status[row.status] ?? row.status}
        </span>
      </div>

      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t.list.implementation}</dt>
          <dd data-testid={`text-module-impl-${id}`}>{row.implementation_available ? t.list.implemented : t.list.notImplemented}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.list.emergency}</dt>
          <dd className={row.emergency_disabled ? "font-semibold text-danger" : undefined} data-testid={`text-module-emergency-${id}`}>
            {row.emergency_disabled ? t.list.emergencyOn : t.list.emergencyOff}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">{t.list.countries}</dt>
          <dd className="break-words" data-testid={`text-module-countries-${id}`}>
            {enabledIn.length > 0 ? enabledIn.join(", ") : t.list.noCountries}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.list.interested}</dt>
          <dd data-testid={`text-module-interest-${id}`}>{Number(row.interest_count)}</dd>
        </div>
      </dl>

      <div className="space-y-4 border-t pt-4">
        <div>
          <ConfirmForm
            action={setModuleStatusAction}
            fields={{ module: id }}
            label={<ButtonLabel visible={t.actions.statusSave} full={t.actions.statusSaveFor(name)} />}
            testId={`button-module-status-${id}`}
          >
            <label htmlFor={`module-status-${id}`} className="text-sm font-medium">
              {t.actions.statusLabel(name)}
            </label>
            <select
              id={`module-status-${id}`}
              name="status"
              defaultValue={options.includes(row.status) ? row.status : options[0]}
              aria-describedby={row.implementation_available ? undefined : `module-status-${id}-hint`}
              className={`${fieldClass} sm:max-w-xs`}
              data-testid={`select-module-status-${id}`}
            >
              {options.map((s) => (
                <option key={s} value={s}>
                  {t.status[s]}
                </option>
              ))}
            </select>
          </ConfirmForm>
          {!row.implementation_available && (
            <p id={`module-status-${id}-hint`} className="mt-1.5 text-sm text-muted-foreground">
              {t.actions.statusLocked}
            </p>
          )}
        </div>

        <div>
          {row.emergency_disabled ? (
            <ConfirmForm
              action={setModuleEmergencyAction}
              fields={{ module: id, disabled: "false" }}
              label={<ButtonLabel visible={t.actions.emergencyOff} full={t.actions.emergencyOffFor(name)} />}
              testId={`button-module-emergency-off-${id}`}
            />
          ) : (
            <ConfirmForm
              action={setModuleEmergencyAction}
              fields={{ module: id, disabled: "true" }}
              label={<ButtonLabel visible={t.actions.emergencyOn} full={t.actions.emergencyOnFor(name)} />}
              confirmTitle={t.actions.emergencyTitle}
              confirmBody={t.actions.emergencyBody}
              confirmLabel={t.actions.emergencyConfirm}
              className={btnDanger}
              testId={`button-module-emergency-on-${id}`}
            />
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium">{t.actions.countriesTitle}</h4>
          {countries.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{t.actions.noActiveCountries}</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-start gap-3">
              {countries.map((c) => {
                const on = isCountryEnabled(row, c.code);
                return (
                  <ConfirmForm
                    key={c.code}
                    action={setModuleCountryAction}
                    fields={{ module: id, country: c.code, enabled: on ? "false" : "true" }}
                    label={
                      on ? (
                        <ButtonLabel visible={t.actions.disable(c.name)} full={t.actions.disableFor(c.name, name)} />
                      ) : (
                        <ButtonLabel visible={t.actions.enable(c.name)} full={t.actions.enableFor(c.name, name)} />
                      )
                    }
                    className={btnQuiet}
                    testId={`button-module-country-${c.code}-${id}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function ModuleList({ rows, countries }: { rows: ModuleRow[]; countries: Country[] }) {
  if (rows.length === 0) {
    return (
      <p className="paper rounded-2xl border p-5 text-sm text-muted-foreground" data-testid="text-modules-empty">
        {t.list.empty}
      </p>
    );
  }
  return (
    <section aria-labelledby="modules-heading">
      <h2 id="modules-heading" className="sr-only">
        {t.list.label}
      </h2>
      <ul className="space-y-3" data-testid="list-modules">
        {rows.map((row) => (
          <ModuleCard key={row.module_id} row={row} countries={countries} />
        ))}
      </ul>
    </section>
  );
}
