"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { pinLoginAction, type PinLoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const initial: PinLoginState = {};

export function QuickSignIn({ staff }: { staff: { id: string; name: string; role: string }[] }) {
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [state, formAction, pending] = useActionState<PinLoginState, FormData>(pinLoginAction, initial);

  if (!picked) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Quick sign-in — no internet needed</p>
        <div className="grid grid-cols-3 gap-2">
          {staff.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setPicked({ id: s.id, name: s.name })}
              className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-3 text-center hover:border-ring hover:bg-accent/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold">
                {s.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="w-full truncate text-xs font-medium">{s.name}</span>
              <span className="text-[10px] text-muted-foreground">{s.role}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="staffId" value={picked.id} />
      <button
        type="button"
        onClick={() => setPicked(null)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Not {picked.name}?
      </button>
      <div className="space-y-1.5 text-center">
        <p className="text-sm font-medium">{picked.name}</p>
        <input
          autoFocus
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{4,6}"
          minLength={4}
          maxLength={6}
          required
          placeholder="PIN"
          className="h-11 w-full rounded-md border border-border bg-background px-3 text-center text-lg tracking-[0.5em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {state.error && (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
