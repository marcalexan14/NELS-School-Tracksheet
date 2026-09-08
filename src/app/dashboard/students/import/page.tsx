import { redirect } from "next/navigation";
import { requireStaff, can } from "@/lib/session";
import { ImportClient } from "@/components/students/import-client";

export default async function ImportStudentsPage() {
  const ctx = await requireStaff();
  if (!can(ctx.role, "students")) redirect("/dashboard/students");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import students from Excel</h1>
        <p className="text-sm text-muted-foreground">
          Bulk-add students and their guardians from a spreadsheet. Optionally enrols them into a
          grade for the current academic year.
        </p>
      </div>
      <ImportClient templateHref="/api/students/import-template" />
    </div>
  );
}
