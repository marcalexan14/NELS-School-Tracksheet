"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Wallet } from "lucide-react";
import { formatEgpExact } from "@/lib/money";

export type PickerRow = {
  id: string;
  code: string;
  name: string;
  latinName: string | null;
  nationalId: string | null;
  status: string;
  gradeName: string | null;
  gradeNameAr: string | null;
  classroomName: string | null;
  primaryGuardian: string | null;
  primaryPhone: string | null;
  balance: string;
};

export function PaymentStudentPicker({
  rows,
  orderedGrades,
  locale,
  labels,
}: {
  rows: PickerRow[];
  orderedGrades: { en: string; label: string }[];
  locale: "en" | "ar";
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [klass, setKlass] = useState("");
  const [onlyOwing, setOnlyOwing] = useState(true);

  const gradeOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.gradeName).filter(Boolean));
    return orderedGrades.filter((g) => present.has(g.en));
  }, [rows, orderedGrades]);
  const classOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .filter((r) => !grade || r.gradeName === grade)
            .map((r) => r.classroomName)
            .filter(Boolean),
        ),
      ].sort() as string[],
    [rows, grade],
  );

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (onlyOwing && Number(r.balance) <= 0) return false;
        if (grade && r.gradeName !== grade) return false;
        if (klass && r.classroomName !== klass) return false;
        if (needle) {
          const hay = [
            r.name,
            r.latinName,
            r.code,
            r.nationalId,
            r.primaryGuardian,
            r.primaryPhone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => Number(b.balance) - Number(a.balance))
      .slice(0, 80);
  }, [rows, q, grade, klass, onlyOwing]);

  function pick(id: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("student", id);
    router.push(`${pathname}?${next.toString()}`);
  }

  const gradeLabel = (r: PickerRow) => (locale === "ar" ? r.gradeNameAr : r.gradeName) ?? "—";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={labels.search}
            className="h-9 w-full rounded-md border border-border bg-background ps-8 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={grade}
          onChange={(e) => {
            setGrade(e.target.value);
            setKlass("");
          }}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">{labels.allGrades}</option>
          {gradeOptions.map((g) => (
            <option key={g.en} value={g.en}>{g.label}</option>
          ))}
        </select>
        <select
          value={klass}
          onChange={(e) => setKlass(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">{labels.allClasses}</option>
          {classOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyOwing}
            onChange={(e) => setOnlyOwing(e.target.checked)}
            className="h-4 w-4"
          />
          {labels.onlyOwing}
        </label>
      </div>

      <div className="text-xs text-muted-foreground">
        {results.length}
        {results.length === 80 ? "+" : ""} {labels.matches}
      </div>

      <div className="max-h-[420px] divide-y divide-border overflow-auto rounded-md border border-border">
        {results.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">{labels.none}</p>
        )}
        {results.map((r) => {
          const owed = Number(r.balance);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => pick(r.id)}
              className="flex w-full items-center justify-between gap-3 p-3 text-start text-sm hover:bg-muted/50"
            >
              <div className="min-w-0">
                <div className="truncate font-medium font-ar">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{r.code}</span> · {gradeLabel(r)}
                  {r.classroomName ? ` · ${r.classroomName}` : ""}
                  {r.primaryPhone ? (
                    <span dir="ltr"> · {r.primaryPhone}</span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 text-end">
                {owed > 0 ? (
                  <span className="font-medium text-destructive">{formatEgpExact(r.balance)}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">{labels.paidUp}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" />
        {labels.hint}
      </p>
    </div>
  );
}
