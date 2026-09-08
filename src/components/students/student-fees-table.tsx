"use client";

import { useActionState, useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { adjustStudentFeeAction, type AdjustState } from "@/app/actions/fees";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEgpExact } from "@/lib/money";

type Line = {
  id: string;
  feeItemName: string;
  gross: string;
  discount: string;
  net: string;
  paid: string;
  remaining: string;
  status: string;
  statusLabel: string;
  installmentCount: number;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PAID: "default",
  PARTIAL: "secondary",
  PENDING: "outline",
  OVERDUE: "destructive",
  WAIVED: "outline",
};

export function StudentFeesTable({
  lines,
  canAdjust,
  labels,
}: {
  lines: Line[];
  canAdjust: boolean;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{labels.fee}</TableHead>
          <TableHead className="text-end">{labels.gross}</TableHead>
          <TableHead className="text-end">{labels.discount}</TableHead>
          <TableHead className="text-end">{labels.net}</TableHead>
          <TableHead className="text-end">{labels.paid}</TableHead>
          <TableHead className="text-end">{labels.remaining}</TableHead>
          <TableHead>{labels.status}</TableHead>
          {canAdjust && <TableHead className="w-20 text-end"></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => {
          const disc = Number(l.discount);
          return (
            <FeeRows
              key={l.id}
              line={l}
              disc={disc}
              canAdjust={canAdjust}
              open={open === l.id}
              onToggle={() => setOpen(open === l.id ? null : l.id)}
              labels={labels}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

function FeeRows({
  line: l,
  disc,
  canAdjust,
  open,
  onToggle,
  labels,
}: {
  line: Line;
  disc: number;
  canAdjust: boolean;
  open: boolean;
  onToggle: () => void;
  labels: Record<string, string>;
}) {
  const [mode, setMode] = useState<"set" | "percent" | "amount_off">("set");
  const [state, formAction, pending] = useActionState<AdjustState, FormData>(
    adjustStudentFeeAction,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok && open) onToggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">
          {l.feeItemName}
          {l.installmentCount > 1 && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {l.installmentCount} {labels.installments}
            </div>
          )}
        </TableCell>
        <TableCell className="text-end tabular-nums text-muted-foreground">{formatEgpExact(l.gross)}</TableCell>
        <TableCell className="text-end tabular-nums text-muted-foreground">
          {disc > 0 ? `-${formatEgpExact(l.discount)}` : disc < 0 ? `+${formatEgpExact(String(-disc))}` : "—"}
        </TableCell>
        <TableCell className="text-end tabular-nums">{formatEgpExact(l.net)}</TableCell>
        <TableCell className="text-end tabular-nums text-primary">{formatEgpExact(l.paid)}</TableCell>
        <TableCell className="text-end tabular-nums">{formatEgpExact(l.remaining)}</TableCell>
        <TableCell><Badge variant={STATUS_VARIANT[l.status] ?? "secondary"}>{l.statusLabel}</Badge></TableCell>
        {canAdjust && (
          <TableCell className="text-end">
            <Button type="button" size="sm" variant="ghost" className="h-7" onClick={onToggle}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> {labels.adjust}
            </Button>
          </TableCell>
        )}
      </TableRow>

      {canAdjust && open && (
        <TableRow className="bg-muted/40">
          <TableCell colSpan={8}>
            <form action={formAction} className="flex flex-wrap items-end gap-3 py-1">
              <input type="hidden" name="studentFeeId" value={l.id} />
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{labels.how}</label>
                <select
                  name="mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="set">{labels.exactAmount}</option>
                  <option value="percent">{labels.percentOff}</option>
                  <option value="amount_off">{labels.amountOff}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  {mode === "percent" ? "%" : "EGP"}
                </label>
                <input
                  name="value"
                  type="number"
                  min={0}
                  step={mode === "percent" ? 1 : 0.01}
                  required
                  defaultValue={mode === "set" ? Number(l.net) : ""}
                  className="h-8 w-32 rounded-md border border-border bg-background px-2 text-sm"
                />
              </div>
              <div className="space-y-1 flex-1 min-w-[160px]">
                <label className="text-xs text-muted-foreground">{labels.reason}</label>
                <input
                  name="reason"
                  placeholder={labels.reasonHint}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                />
              </div>
              <Button type="submit" size="sm" className="h-8" disabled={pending}>{labels.save}</Button>
              <button type="button" onClick={onToggle} className="pb-1.5 text-xs text-muted-foreground hover:text-foreground">
                {labels.cancel}
              </button>
            </form>
            {state.error ? (
              <p className="pb-1 text-xs text-destructive">{state.error}</p>
            ) : (
              <p className="pb-1 text-xs text-muted-foreground">{labels.adjustHint}</p>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
