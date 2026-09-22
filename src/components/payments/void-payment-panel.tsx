"use client";

import { useActionState, useState } from "react";
import { Ban } from "lucide-react";
import { voidPaymentAction, type VoidState } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";

const initial: VoidState = { done: false };

export function VoidPaymentPanel({
  paymentId,
  labels,
}: {
  paymentId: string;
  labels: { open: string; reason: string; reasonHint: string; confirm: string; cancel: string };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<VoidState, FormData>(voidPaymentAction, initial);

  if (state.done) {
    // The server action already revalidated this page; a full reload picks up
    // the "voided" banner immediately.
    if (typeof window !== "undefined") window.location.reload();
    return null;
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Ban className="h-4 w-4" /> {labels.open}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <input
        name="reason"
        required
        placeholder={labels.reasonHint}
        className="h-8 w-56 rounded-md border border-border bg-background px-2 text-sm"
      />
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {labels.confirm}
      </Button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
        {labels.cancel}
      </button>
      {state.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
