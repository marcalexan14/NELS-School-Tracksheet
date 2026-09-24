"use client";

import { useRef } from "react";
import { Eye } from "lucide-react";
import { startPreviewAction } from "@/app/actions/preview";

const ROLES: { value: string; label: string }[] = [
  { value: "REGISTRAR", label: "Registrar" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "TEACHER", label: "Teacher" },
  { value: "VIEWER", label: "Viewer" },
];

// Owner/Admin only: pick a role and the whole app — nav, pages, and what you
// can actually save — switches to exactly what that role would see. Lets
// Marc "be" a Registrar or Accountant for a minute instead of just reading
// about what they can do.
export function PreviewSwitcher() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={startPreviewAction} className="flex items-center gap-1.5">
      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        name="role"
        defaultValue=""
        onChange={() => formRef.current?.requestSubmit()}
        className="h-8 rounded-md border border-border bg-background px-1.5 text-xs text-muted-foreground"
      >
        <option value="" disabled>
          Look like…
        </option>
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </form>
  );
}
