export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Thousands-separated integer, Spanish style: 12500 -> "12.500". */
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("es-ES");
}

/** Kilograms with two decimals, Spanish style: 0.389 -> "0,39". */
export function formatKg(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-10-07" -> "Miércoles 7 de octubre" (local calendar date). */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${weekday[0].toUpperCase()}${weekday.slice(1)} ${d} de ${MONTHS[m - 1]}`;
}

/** Local calendar date as YYYY-MM-DD (not UTC, unlike Date#toISOString). */
export function localISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Shifts a YYYY-MM-DD date by `delta` calendar days (local time). */
export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return localISODate(date);
}
