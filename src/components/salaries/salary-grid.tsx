"use client";

import { useMemo, useRef, useState, useTransition, useActionState } from "react";
import { Search, Upload, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  updateSalaryAction,
  bulkIncreaseSalariesAction,
  importSalariesAction,
  type SalaryImportState,
} from "@/app/actions/salaries";
import { formatEgpExact } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type SalaryRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  baseSalary: string | null;
};

const emptyImport: SalaryImportState = { done: false, updated: 0, unmatched: [] };

// One editable cell: click to edit, Enter or blur to save, Escape to cancel.
// This is the "like it's an Excel" part — no separate edit mode for the row.
function SalaryCell({ row, editable }: { row: SalaryRow; editable: boolean }) {
  const [value, setValue] = useState(row.baseSalary ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function save() {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed === (row.baseSalary ?? "")) return;
    startTransition(async () => {
      const res = await updateSalaryAction({ staffId: row.id, amount: trimmed || "0" });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save.");
        setValue(row.baseSalary ?? "");
      } else {
        setError(null);
        row.baseSalary = trimmed || "0"; // keep the local row in sync until the page re-fetches
      }
    });
  }

  if (!editable) {
    return (
      <span className="tabular-nums">
        {row.baseSalary ? formatEgpExact(row.baseSalary) : <span className="text-muted-foreground">—</span>}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape") { setValue(row.baseSalary ?? ""); setEditing(false); }
        }}
        className="h-8 w-32 rounded-md border border-ring bg-background px-2 text-sm tabular-nums outline-none ring-2 ring-ring/50"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={pending}
      className="flex h-8 w-32 items-center rounded-md border border-transparent px-2 text-sm tabular-nums hover:border-border hover:bg-accent/50"
      title="Click to edit"
    >
      {pending ? "Saving…" : row.baseSalary ? formatEgpExact(row.baseSalary) : <span className="text-muted-foreground">Set salary</span>}
      {error && <span className="ms-2 text-xs text-destructive">{error}</span>}
    </button>
  );
}

export function SalaryGrid({ rows, editable }: { rows: SalaryRow[]; editable: boolean }) {
  const [q, setQ] = useState("");
  const [percent, setPercent] = useState("");
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkPending, startBulk] = useTransition();
  const [importState, importAction, importing] = useActionState<SalaryImportState, FormData>(
    importSalariesAction,
    emptyImport,
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle));
  }, [rows, q]);

  const total = rows.reduce((sum, r) => sum + Number(r.baseSalary ?? 0), 0);

  function applyIncrease() {
    const pct = Number(percent);
    if (!Number.isFinite(pct) || pct === 0) {
      setBulkMsg("Enter a non-zero percentage, e.g. 10 for +10%.");
      return;
    }
    startBulk(async () => {
      const res = await bulkIncreaseSalariesAction({ percent: pct });
      setBulkMsg(
        res.ok
          ? `Applied ${pct > 0 ? "+" : ""}${pct}% to ${res.updated} staff member${res.updated === 1 ? "" : "s"}. Refresh to see the new totals.`
          : res.error ?? "Couldn't apply.",
      );
      if (res.ok) setPercent("");
    });
  }

  return (
    <div className="space-y-4">
      {editable && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Percentage increase</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 10"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  className="h-9 w-28 rounded-md border border-border bg-background px-2 text-sm"
                />
                <span className="text-sm text-muted-foreground">%</span>
                <Button size="sm" onClick={applyIncrease} disabled={bulkPending}>
                  <TrendingUp className="h-4 w-4" /> {bulkPending ? "Applying…" : "Apply to everyone"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Raises (or cuts, with a negative number) every staff member who already has a salary set. Each change is logged.
              </p>
              {bulkMsg && <p className="text-sm">{bulkMsg}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import from Excel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <form action={importAction} className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  name="file"
                  accept=".xlsx,.xls,.csv"
                  required
                  className="text-sm file:mr-2 file:rounded-md file:border file:border-border file:bg-background file:px-2.5 file:py-1 file:text-sm"
                />
                <Button type="submit" size="sm" disabled={importing}>
                  <Upload className="h-4 w-4" /> {importing ? "Importing…" : "Import"}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Matches rows by staff email (or full name) against the template downloaded above.
              </p>
              {importState.done && !importState.error && (
                <p className="flex items-center gap-1.5 text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Updated {importState.updated} salar{importState.updated === 1 ? "y" : "ies"}.
                  {importState.unmatched.length > 0 && ` ${importState.unmatched.length} row(s) unmatched.`}
                </p>
              )}
              {importState.unmatched.length > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  Couldn&apos;t match: {importState.unmatched.join(", ")}
                </p>
              )}
              {importState.error && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" /> {importState.error}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 p-4">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search staff…"
                className="h-9 w-full rounded-md border border-border bg-background ps-8 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <span className="text-xs text-muted-foreground">{filtered.length}</span>
            <span className="ms-auto text-sm font-medium">Total: {formatEgpExact(total)}/mo</span>
          </div>
          <div className="max-h-[600px] overflow-auto border-t border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Monthly salary (EGP)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No staff found.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell><Badge variant="outline">{r.role}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{r.title ?? "—"}</TableCell>
                    <TableCell><SalaryCell row={r} editable={editable} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
