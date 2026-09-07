import { formatEgpCompact } from "@/lib/money";

export type BarRow = {
  label: string;
  subLabel?: string;
  primary: number;
  secondary?: number;
};

// Horizontal bars sharing one scale. When `secondary` is given it's drawn as a
// filled segment (e.g. collected) against the full `primary` track (billed).
export function BarList({
  rows,
  primaryColor = "var(--primary)",
  secondaryColor = "color-mix(in oklch, var(--primary) 22%, transparent)",
  emptyLabel,
}: {
  rows: BarRow[];
  primaryColor?: string;
  secondaryColor?: string;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const max = Math.max(...rows.map((r) => r.primary), 1);

  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((r) => {
        const trackPct = (r.primary / max) * 100;
        const fillPct = r.secondary !== undefined && r.primary > 0 ? (r.secondary / r.primary) * 100 : 100;
        return (
          <div key={r.label + (r.subLabel ?? "")}>
            <div className="mb-1 flex items-baseline justify-between text-[13px]">
              <span className="font-medium">
                {r.label}
                {r.subLabel && (
                  <span className="ms-1.5 font-ar text-xs text-muted-foreground">{r.subLabel}</span>
                )}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatEgpCompact(r.secondary !== undefined ? r.secondary : r.primary)}
                {r.secondary !== undefined && (
                  <span className="text-muted-foreground/70"> / {formatEgpCompact(r.primary)}</span>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${trackPct}%`, background: secondaryColor }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, fillPct)}%`, background: primaryColor }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
