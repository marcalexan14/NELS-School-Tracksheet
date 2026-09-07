"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEgp } from "@/lib/money";

type Point = { month: string; collected: number };

const COLORS = {
  light: { line: "#147c70", grid: "#e5e7ea", muted: "#6e7681" },
  dark: { line: "#4fc9b6", grid: "#2b313b", muted: "#8a929e" },
};

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en", { month: "short", year: "2-digit" });
}

function TooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-xs shadow-md">
      <div className="mb-1 font-medium text-popover-foreground">{monthLabel(label ?? "")}</div>
      <div className="font-medium tabular-nums text-popover-foreground">
        {formatEgp(payload[0].value)}
      </div>
    </div>
  );
}

export function CollectionsChart({ data, emptyLabel }: { data: Point[]; emptyLabel: string }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  const c = mounted && resolvedTheme === "dark" ? COLORS.dark : COLORS.light;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="collectFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={c.line} stopOpacity={0.28} />
            <stop offset="95%" stopColor={c.line} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          stroke={c.muted}
          tickFormatter={monthLabel}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={11}
          stroke={c.muted}
          width={52}
          tickFormatter={(v) => `EGP ${compact.format(v)}`}
        />
        <Tooltip content={<TooltipBox />} />
        <Area
          type="monotone"
          dataKey="collected"
          stroke={c.line}
          strokeWidth={2}
          fill="url(#collectFill)"
          activeDot={{ r: 4 }}
          animationDuration={600}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
