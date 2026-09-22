"use client";

import { useActionState, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { updateGuardianAction, deleteGuardianAction, type ActionResult } from "@/app/actions/students";
import { enumLabel, type Locale } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Guardian = {
  id: string;
  studentId: string;
  relation: string;
  name: string;
  nationalId: string | null;
  phone: string;
  altPhone: string | null;
  email: string | null;
  occupation: string | null;
  workplace: string | null;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
};

const RELATIONS = ["FATHER", "MOTHER", "GRANDPARENT", "SIBLING", "UNCLE_AUNT", "LEGAL_GUARDIAN", "OTHER"];
const initial: ActionResult = { ok: true };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

export function GuardianCard({
  guardian: g,
  locale,
  canEdit,
  labels,
}: {
  guardian: Guardian;
  locale: Locale;
  canEdit: boolean;
  labels: Record<string, string>;
}) {
  const relationLabel = (r: string) => enumLabel(locale, r);
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState<ActionResult, FormData>(updateGuardianAction, initial);
  const [deleteState, deleteActionFn, deletePending] = useActionState<ActionResult, FormData>(deleteGuardianAction, initial);

  const [handled, setHandled] = useState(updateState);
  if (updateState !== handled) {
    setHandled(updateState);
    if (updateState.ok && !updateState.error && editing) setEditing(false);
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="p-5">
          <form action={updateAction} className="space-y-3">
            <input type="hidden" name="guardianId" value={g.id} />
            <input type="hidden" name="studentId" value={g.studentId} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor={`gn-${g.id}`}>{labels.name}</Label>
                <Input id={`gn-${g.id}`} name="name" defaultValue={g.name} required className="font-ar" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`gr-${g.id}`}>{labels.relation}</Label>
                <select id={`gr-${g.id}`} name="relation" defaultValue={g.relation} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                  {RELATIONS.map((r) => <option key={r} value={r}>{relationLabel(r)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`gp-${g.id}`}>{labels.phone}</Label>
                <Input id={`gp-${g.id}`} name="phone" defaultValue={g.phone} dir="ltr" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`ga-${g.id}`}>{labels.altPhone}</Label>
                <Input id={`ga-${g.id}`} name="altPhone" defaultValue={g.altPhone ?? ""} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`ge-${g.id}`}>Email</Label>
                <Input id={`ge-${g.id}`} name="email" type="email" defaultValue={g.email ?? ""} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`go-${g.id}`}>{labels.occupation}</Label>
                <Input id={`go-${g.id}`} name="occupation" defaultValue={g.occupation ?? ""} className="font-ar" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`gnid-${g.id}`}>{labels.nationalId}</Label>
                <Input id={`gnid-${g.id}`} name="nationalId" defaultValue={g.nationalId ?? ""} dir="ltr" maxLength={14} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPrimaryContact" defaultChecked={g.isPrimaryContact} className="h-4 w-4" /> {labels.primaryContact}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isEmergencyContact" defaultChecked={g.isEmergencyContact} className="h-4 w-4" /> {labels.emergencyContact}
            </label>
            {updateState.error && <p className="text-sm text-destructive">{updateState.error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={updatePending}>{labels.save}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" /> {labels.cancel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-medium font-ar">{g.name}</p>
          <Badge variant="secondary">{relationLabel(g.relation)}</Badge>
        </div>
        <dl className="mt-3 space-y-2">
          <Field label={labels.phone} value={<span dir="ltr">{g.phone}{g.altPhone ? ` · ${g.altPhone}` : ""}</span>} />
          <Field label="Email" value={<span dir="ltr">{g.email}</span>} />
          <Field label={labels.occupation} value={<span className="font-ar">{g.occupation}</span>} />
          <Field label={labels.nationalId} value={<span dir="ltr">{g.nationalId}</span>} />
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {g.isPrimaryContact && <Badge>{labels.primaryContact}</Badge>}
          {g.isEmergencyContact && <Badge variant="outline">{labels.emergencyContact}</Badge>}
          {canEdit && (
            <div className="ms-auto flex gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> {labels.edit}
              </Button>
              <form action={deleteActionFn}>
                <input type="hidden" name="guardianId" value={g.id} />
                <input type="hidden" name="studentId" value={g.studentId} />
                <Button type="submit" variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive" disabled={deletePending}>
                  <Trash2 className="h-3.5 w-3.5" /> {labels.remove}
                </Button>
              </form>
            </div>
          )}
        </div>
        {deleteState.error && <p className="mt-2 text-xs text-destructive">{deleteState.error}</p>}
      </CardContent>
    </Card>
  );
}
