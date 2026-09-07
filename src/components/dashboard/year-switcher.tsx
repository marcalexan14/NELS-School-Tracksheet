"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";

type Year = { id: string; name: string; isCurrent: boolean };

// Rewrites ?year=<id> on the current page. Server components read it to scope
// every query to the chosen academic year.
export function YearSwitcher({ years, label }: { years: Year[]; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (years.length === 0) return null;

  const current = params.get("year") ?? years.find((y) => y.isCurrent)?.id ?? years[0].id;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("year", e.target.value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="sr-only">{label}</span>
      <select
        value={current}
        onChange={onChange}
        dir="ltr"
        className="bg-transparent pe-1 text-xs font-medium outline-none"
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
          </option>
        ))}
      </select>
    </label>
  );
}
