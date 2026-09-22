"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { addDiscountAction, deleteDiscountAction, type ActionResult } from "@/app/actions/students";
import { enumLabel, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { formatEgpExact } from "@/lib/money";

type Discount = {
  id: string;
  kind: string;
  basis: "PERCENT" | "AMOUNT";
  value: string;
  appliesToCategory: string | null;
  academicYearName: string;
};
const KINDS = ["SIBLING", "STAFF_CHILD", "MERIT", "HARDSHIP", "EARLY_PAYMENT", "OTHER"];
const CATEGORIES = ["TUITION", "REGISTRATION", "TRANSPORT", "BOOKS", "UNIFORM", "ACTIVITIES", "EXAMS", "MEALS", "OTHER"];
const initial: ActionResult = { ok: true };

function DeleteButton({ discountId, studentId, label }: { discountId: string; studentId: string; label: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(deleteDiscountAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="discountId" value={discountId} />
      <input type="hidden" name="studentId" value={studentId} />
      <Button type="submit" variant="ghost" size="sm" className="h-6 px-1.5 text-destructive hover:text-destructive" disabled={pending}>
        <Trash2 className="h-3 w-3" /> {label}
      </Button>
      {state.error && <span className="ms-2 text-xs text-destructive">{state.error}</span>}
    </form>
  );
}

export function DiscountsPanel({
  studentId,
  currentYearId,
  discounts,
  locale,
  labels,
}: {
  studentId: string;
  currentYearId: string | null;
  discounts: Discount[];
  locale: Locale;
  labels: Record<string, string>;
}) {
  const kindLabel = (k: string) => enumLabel(locale, k);
  const categoryLabel = (c: string) => enumLabel(locale, c);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(addDiscountAction, initial);

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok && !state.error && open) setOpen(false);
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{labels.title}</p>
        {currentYearId && !open && (
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> {labels.add}
          </Button>
        )}
      </div>

      {discounts.length === 0 && !open && <p className="text-sm text-muted-foreground">{labels.none}</p>}

      {discounts.length > 0 && (
        <ul className="space-y-1 text-sm">
          {discounts.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              <span>
                {kindLabel(d.kind)} — {d.basis === "PERCENT" ? `${d.value}%` : formatEgpExact(d.value)}
                {d.appliesToCategory ? ` (${categoryLabel(d.appliesToCategory)})` : ""} · {d.academicYearName}
              </span>
              <DeleteButton discountId={d.id} studentId={studentId} label={labels.remove} />
            </li>
          ))}
        </ul>
      )}

      {open && currentYearId && (
        <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="academicYearId" value={currentYearId} />
          <select name="kind" defaultValue="SIBLING" className="h-8 rounded-md border border-border bg-background px-2 text-sm">
            {KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </select>
          <select name="basis" defaultValue="PERCENT" className="h-8 rounded-md border border-border bg-background px-2 text-sm">
            <option value="PERCENT">%</option>
            <option value="AMOUNT">EGP</option>
          </select>
          <input name="value" type="number" min={0} step="0.01" required placeholder={labels.value} className="h-8 w-24 rounded-md border border-border bg-background px-2 text-sm" />
          <select name="appliesToCategory" defaultValue="TUITION" className="h-8 rounded-md border border-border bg-background px-2 text-sm">
            {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
          <input name="note" placeholder={labels.note} className="h-8 w-40 rounded-md border border-border bg-background px-2 text-sm" />
          <Button type="submit" size="sm" className="h-8" disabled={pending}>{labels.save}</Button>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
            <X className="inline h-3 w-3" /> {labels.cancel}
          </button>
          {state.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
