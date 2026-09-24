import { eq } from "drizzle-orm";
import { FileSpreadsheet } from "lucide-react";
import { requireView, can } from "@/lib/session";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { enumLabel, type Locale } from "@/lib/i18n";
import { SalaryGrid, type SalaryRow } from "@/components/salaries/salary-grid";
import { Button } from "@/components/ui/button";

export default async function SalariesPage() {
  const ctx = await requireView("salaries");
  const locale = (ctx.school.locale as Locale) ?? "en";
  const editable = can(ctx.role, "salaries");

  const rows = await db.query.staff.findMany({
    where: eq(staff.schoolId, ctx.schoolId),
    with: { user: { columns: { name: true, email: true } } },
    orderBy: (s, { asc }) => asc(s.createdAt),
  });

  const data: SalaryRow[] = rows.map((r) => ({
    id: r.id,
    name: r.user.name ?? r.user.email,
    email: r.user.email,
    role: enumLabel(locale, r.role),
    title: r.title,
    baseSalary: r.baseSalary,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Salaries</h1>
          <p className="text-sm text-muted-foreground">
            Owner / Admin only. Click any amount to edit it directly, like a spreadsheet cell.
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<a href="/api/salaries/template" />}>
          <FileSpreadsheet className="h-4 w-4" /> Download template (.xlsx)
        </Button>
      </div>

      <SalaryGrid rows={data} editable={editable} />
    </div>
  );
}
