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
