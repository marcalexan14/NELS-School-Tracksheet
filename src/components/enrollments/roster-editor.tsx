"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Check, X, Pencil } from "lucide-react";
import { updateEnrollment, bulkMoveEnrollments } from "@/app/actions/enrollments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { enumLabel, type Locale } from "@/lib/i18n";

export type RosterRow = {
  id: string;
  code: string;
  name: string;
  gradeLevelId: string;
  classroomId: string | null;
  status: "ACTIVE" | "COMPLETED" | "WITHDRAWN";
};
export type GradeOpt = { id: string; name: string; nameAr: string; ordinal: number };
export type ClassOpt = { id: string; name: string; gradeLevelId: string };

const STATUSES: RosterRow["status"][] = ["ACTIVE", "COMPLETED", "WITHDRAWN"];

export function RosterEditor({
  rows,
  grades,
  classrooms,
  editable,
  locale,
  labels,
  initialSearch = "",
}: {
  rows: RosterRow[];
  grades: GradeOpt[];
  classrooms: ClassOpt[];
  editable: boolean;
  locale: Locale;
  labels: Record<string, string>;
  initialSearch?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(initialSearch);
  const [gradeFilter, setGradeFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ gradeLevelId: string; classroomId: string; status: RosterRow["status"] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkClass, setBulkClass] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const gradeName = (id: string) => {
    const g = grades.find((x) => x.id === id);
    return g ? (locale === "ar" ? g.nameAr : g.name) : "—";
  };
  const className = (id: string | null) => classrooms.find((c) => c.id === id)?.name ?? null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (gradeFilter && r.gradeLevelId !== gradeFilter) return false;
      if (classFilter === "__none" ? r.classroomId !== null : classFilter && r.classroomId !== classFilter) return false;
      if (needle && !r.name.toLowerCase().includes(needle) && !r.code.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, gradeFilter, classFilter]);

  function beginEdit(r: RosterRow) {
    setEditing(r.id);
    setDraft({ gradeLevelId: r.gradeLevelId, classroomId: r.classroomId ?? "", status: r.status });
    setMsg(null);
  }

  function saveEdit() {
    if (!editing || !draft) return;
    startTransition(async () => {
      const res = await updateEnrollment({
        enrollmentId: editing,
        gradeLevelId: draft.gradeLevelId,
        classroomId: draft.classroomId || null,
        status: draft.status,
      });
      if (res.ok) {
        setEditing(null);
        setDraft(null);
        router.refresh();
      } else {
        setMsg(res.error ?? "Couldn't save.");
      }
    });
  }

  function runBulkMove() {
    if (!bulkClass || selected.size === 0) return;
    startTransition(async () => {
      const res = await bulkMoveEnrollments({ enrollmentIds: [...selected], classroomId: bulkClass });
      if (res.ok) {
        setMsg(`Moved ${res.moved} student${res.moved === 1 ? "" : "s"}.`);
        setSelected(new Set());
        setBulkClass("");
        router.refresh();
      } else {
        setMsg(res.error ?? "Couldn't move.");
      }
    });
  }

  const draftClassOptions = draft
    ? classrooms.filter((c) => c.gradeLevelId === draft.gradeLevelId)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={labels.search}
            className="h-9 w-full rounded-md border border-border bg-background ps-8 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setClassFilter(""); }} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">{labels.allGrades}</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>{locale === "ar" ? g.nameAr : g.name}</option>
          ))}
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">{labels.allClasses}</option>
          <option value="__none">{labels.unassigned}</option>
          {classrooms
            .filter((c) => !gradeFilter || c.gradeLevelId === gradeFilter)
            .map((c) => (
              <option key={c.id} value={c.id}>{gradeName(c.gradeLevelId)} · {c.name}</option>
            ))}
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length}</span>
      </div>

      {editable && selected.size > 0 && (
        <div className="mx-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-2 text-sm">
          <span className="font-medium">{selected.size} {labels.selected}</span>
          <span className="text-muted-foreground">→</span>
          <select value={bulkClass} onChange={(e) => setBulkClass(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-sm">
            <option value="">{labels.moveTo}…</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>{gradeName(c.gradeLevelId)} · {c.name}</option>
            ))}
          </select>
          <Button size="sm" onClick={runBulkMove} disabled={!bulkClass || pending}>{labels.move}</Button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">{labels.clear}</button>
        </div>
      )}

      {msg && <p className="px-4 text-sm text-muted-foreground">{msg}</p>}

      <div className="max-h-[560px] overflow-auto border-t border-border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              {editable && <TableHead className="w-8"></TableHead>}
              <TableHead>{labels.code}</TableHead>
              <TableHead>{labels.name}</TableHead>
              <TableHead>{labels.grade}</TableHead>
              <TableHead>{labels.classroom}</TableHead>
              <TableHead>{labels.status}</TableHead>
              {editable && <TableHead className="w-24 text-end">{labels.actions}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={editable ? 7 : 5} className="py-10 text-center text-sm text-muted-foreground">
                  {labels.none}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) =>
              editing === r.id && draft ? (
                <TableRow key={r.id} className="bg-muted/40">
                  {editable && <TableCell></TableCell>}
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.code}</TableCell>
                  <TableCell className="font-ar">{r.name}</TableCell>
                  <TableCell>
                    <select
                      value={draft.gradeLevelId}
                      onChange={(e) => setDraft({ ...draft, gradeLevelId: e.target.value, classroomId: "" })}
                      className="h-8 w-full rounded-md border border-border bg-background px-1.5 text-sm"
                    >
                      {grades.map((g) => (
                        <option key={g.id} value={g.id}>{locale === "ar" ? g.nameAr : g.name}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <select
                      value={draft.classroomId}
                      onChange={(e) => setDraft({ ...draft, classroomId: e.target.value })}
                      className="h-8 w-full rounded-md border border-border bg-background px-1.5 text-sm"
                    >
                      <option value="">{labels.unassigned}</option>
                      {draftClassOptions.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <select
                      value={draft.status}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value as RosterRow["status"] })}
                      className="h-8 w-full rounded-md border border-border bg-background px-1.5 text-sm"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{enumLabel(locale, s)}</option>
                      ))}
                    </select>
                  </TableCell>
                  {editable && (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit} disabled={pending} aria-label={labels.save}>
                          <Check className="h-4 w-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(null); setDraft(null); }} aria-label={labels.cancel}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ) : (
                <TableRow key={r.id}>
                  {editable && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(r.id);
                          else next.delete(r.id);
                          setSelected(next);
                        }}
                        className="h-4 w-4"
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.code}</TableCell>
                  <TableCell className="font-ar">{r.name}</TableCell>
                  <TableCell>{gradeName(r.gradeLevelId)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {className(r.classroomId) ?? <Badge variant="outline">{labels.unassigned}</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "ACTIVE" ? "secondary" : "outline"}>{enumLabel(locale, r.status)}</Badge>
                  </TableCell>
                  {editable && (
                    <TableCell className="text-end">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => beginEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" /> {labels.edit}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
