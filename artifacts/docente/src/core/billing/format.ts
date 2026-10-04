// Importes y fechas de la etapa 5. Funciones puras, sin Intl: el resultado es el mismo en el
// servidor, en el navegador y en las pruebas. Los importes son de PRUEBA y solo se muestran.
import { formatLima } from "../admin/avisos-dates";
import { planes } from "../../i18n/es-planes";

const SYMBOLS: Record<string, string> = { PEN: "S/", USD: "US$" };

/**
 * Importe en unidades menores (céntimos) → «S/ 19.90». Separador de miles «,» y decimal «.»
 * (es-PE). Una moneda sin símbolo conocido se muestra con su código. Un valor que no es entero
 * seguro devuelve «—»: nunca se inventa un importe.
 */
export function formatMinor(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor)) return "—";
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = String(abs % 100).padStart(2, "0");
  const symbol = SYMBOLS[currency.toUpperCase()] ?? currency.toUpperCase();
  return `${sign}${symbol} ${whole}.${cents}`;
}

/** «S/ 19.90 al mes». Si el periodo no se conoce, solo el importe. */
export function formatPrice(amountMinor: number, currency: string, period?: string | null): string {
  const base = formatMinor(amountMinor, currency);
  const suffix = period ? planes.common.perPeriod[period] : undefined;
  return suffix ? `${base} ${suffix}` : base;
}

/** Instante → «3 oct 2026, 08:30» en hora de Lima (UTC-5), o «» si no es una fecha. */
export function formatDateTimeLima(iso: string | null | undefined): string {
  return formatLima(iso);
}

/** Instante → «3 oct 2026» en hora de Lima, o «» si no es una fecha. */
export function formatDateLima(iso: string | null | undefined): string {
  return formatLima(iso).split(",")[0] ?? "";
}
