import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/session";
import { db } from "@/db";
import { gradeLevels } from "@/db/schema";
import { buildTemplateWorkbook } from "@/lib/student-import";

export async function GET() {
  const ctx = await requireStaff();
  const grades = await db.query.gradeLevels.findMany({
    where: eq(gradeLevels.schoolId, ctx.schoolId),
    orderBy: (g, { asc }) => asc(g.ordinal),
    columns: { id: true, name: true, nameAr: true },
  });

  const bytes = buildTemplateWorkbook(
    grades.map((g) => ({ id: g.id, name: g.name, nameAr: g.nameAr })),
  );

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="nels-student-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
