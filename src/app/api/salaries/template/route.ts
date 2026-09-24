import { eq } from "drizzle-orm";
import { requireView } from "@/lib/session";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { buildSalaryTemplateWorkbook } from "@/lib/salary-import";

export async function GET() {
  const ctx = await requireView("salaries");
  const rows = await db.query.staff.findMany({
    where: eq(staff.schoolId, ctx.schoolId),
    with: { user: { columns: { name: true, email: true } } },
  });

  const bytes = buildSalaryTemplateWorkbook(
    rows.map((r) => ({ name: r.user.name ?? r.user.email, email: r.user.email })),
  );

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="nels-salary-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
