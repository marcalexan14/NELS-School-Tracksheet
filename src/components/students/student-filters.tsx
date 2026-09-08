"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

type GradeOpt = { id: string; label: string };
type StatusOpt = { value: string; label: string };

// Drives ?q / ?grade / ?status on the students page. Text is debounced; the
// selects apply immediately. No submit button.
export function StudentFilters({
  grades,
  statuses,
  placeholder,
  allGradesLabel,
  allStatusesLabel,
}: {
  grades: GradeOpt[];
  statuses: StatusOpt[];
  placeholder: string;
  allGradesLabel: string;
  allStatusesLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);

  function apply(next: URLSearchParams) {
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value) next.set(key, value);
    else next.delete(key);
    apply(next);
  }

  // Debounce the text box.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => setParam("q", q.trim()), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-border bg-background ps-8 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <select
        value={params.get("grade") ?? ""}
        onChange={(e) => setParam("grade", e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">{allGradesLabel}</option>
        {grades.map((g) => (
          <option key={g.id} value={g.id}>{g.label}</option>
        ))}
      </select>
      <select
        value={params.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">{allStatusesLabel}</option>
        {statuses.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}
