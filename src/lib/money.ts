// All amounts are stored as numeric(12,2) strings in Postgres and passed around
// as `string` in Drizzle. These helpers keep the arithmetic honest — work in
// integer piastres internally, format for display in Egyptian pounds.

export function toPiastres(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export function fromPiastres(piastres: number): string {
  return (piastres / 100).toFixed(2);
}

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Rounded, for dashboards and headline figures ("EGP 33,900,000").
export function formatEgp(value: string | number): string {
  return `EGP ${whole.format(Number(value))}`;
}

// Two-decimal, for receipts, ledgers, and anything a parent will reconcile.
export function formatEgpExact(value: string | number): string {
  return `EGP ${exact.format(Number(value))}`;
}

// Compact, for KPI tiles ("EGP 48.6M").
export function formatEgpCompact(value: string | number): string {
  const n = Number(value);
  if (Math.abs(n) >= 1_000_000) return `EGP ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `EGP ${(n / 1_000).toFixed(0)}K`;
  return formatEgp(n);
}

export function sumStrings(values: (string | number)[]): number {
  return values.reduce<number>((total, v) => total + toPiastres(v), 0) / 100;
}
