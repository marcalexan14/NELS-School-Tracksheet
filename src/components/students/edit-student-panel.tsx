"use client";

import { useActionState, useState } from "react";
import { Pencil, X } from "lucide-react";
import { updateStudentAction, type ActionResult } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Student = {
  id: string;
  firstName: string;
  secondName: string | null;
  thirdName: string | null;
  familyName: string;
  latinName: string | null;
  nationalId: string | null;
  gender: "MALE" | "FEMALE";
  dateOfBirth: string;
  birthGovernorate: string | null;
  nationality: string;
  religion: "MUSLIM" | "CHRISTIAN" | "OTHER" | null;
  address: string | null;
};

const GOVERNORATES = [
  "Cairo", "Giza", "Alexandria", "Qalyubia", "Dakahlia", "Sharqia", "Gharbia",
  "Monufia", "Beheira", "Kafr El Sheikh", "Damietta", "Port Said", "Ismailia",
  "Suez", "Faiyum", "Beni Suef", "Minya", "Asyut", "Sohag", "Qena", "Luxor",
  "Aswan", "Red Sea", "New Valley", "Matrouh", "North Sinai", "South Sinai",
];

const initial: ActionResult = { ok: true };

export function EditStudentPanel({
  student,
  children,
  labels,
}: {
  student: Student;
  children: React.ReactNode; // the read-only <dl> view, rendered when not editing
  labels: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(updateStudentAction, initial);

  // Close the panel once a submit succeeds. Adjusting state during render
  // (guarded so it only fires when `state` actually changed) rather than in
  // an effect, per React's docs on responding to a prop/state change.
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok && !state.error && editing) setEditing(false);
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-2 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> {labels.edit}
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="studentId" value={student.id} />
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          <X className="h-3.5 w-3.5" /> {labels.cancel}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="e-first">{labels.firstName}</Label>
          <Input id="e-first" name="firstName" defaultValue={student.firstName} required className="font-ar" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-second">{labels.secondName}</Label>
          <Input id="e-second" name="secondName" defaultValue={student.secondName ?? ""} className="font-ar" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-third">{labels.thirdName}</Label>
          <Input id="e-third" name="thirdName" defaultValue={student.thirdName ?? ""} className="font-ar" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-family">{labels.familyName}</Label>
          <Input id="e-family" name="familyName" defaultValue={student.familyName} required className="font-ar" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="e-latin">{labels.latinName}</Label>
          <Input id="e-latin" name="latinName" defaultValue={student.latinName ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-nid">{labels.nationalId}</Label>
          <Input id="e-nid" name="nationalId" defaultValue={student.nationalId ?? ""} dir="ltr" maxLength={14} inputMode="numeric" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-gender">{labels.gender}</Label>
          <select id="e-gender" name="gender" defaultValue={student.gender} required className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
            <option value="MALE">{labels.male}</option>
            <option value="FEMALE">{labels.female}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-dob">{labels.dateOfBirth}</Label>
          <Input id="e-dob" name="dateOfBirth" type="date" defaultValue={student.dateOfBirth} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-religion">{labels.religion}</Label>
          <select id="e-religion" name="religion" defaultValue={student.religion ?? ""} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
            <option value="">—</option>
            <option value="MUSLIM">{labels.muslim}</option>
            <option value="CHRISTIAN">{labels.christian}</option>
            <option value="OTHER">{labels.other}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-nationality">{labels.nationality}</Label>
          <Input id="e-nationality" name="nationality" defaultValue={student.nationality} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-gov">{labels.birthGovernorate}</Label>
          <select id="e-gov" name="birthGovernorate" defaultValue={student.birthGovernorate ?? ""} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
            <option value="">—</option>
            {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
          <Label htmlFor="e-address">{labels.address}</Label>
          <Input id="e-address" name="address" defaultValue={student.address ?? ""} className="font-ar" />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>{labels.save}</Button>
    </form>
  );
}
