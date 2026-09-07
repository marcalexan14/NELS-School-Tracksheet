import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  sub,
  progress,
  progressColor = "var(--primary)",
  icon,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  progress?: number; // 0..100
  progressColor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="card-hover overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
          {icon && <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        {progress !== undefined && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%`, background: progressColor }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
