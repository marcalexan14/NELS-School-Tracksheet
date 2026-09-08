import { and, eq } from "drizzle-orm";
import { requireStaff } from "@/lib/session";
import { db } from "@/db";
import { academicYears } from "@/db/schema";
import { buildExportWorkbook } from "@/lib/export";

export const dynamic = "force-dynamic";

// Full data export as a multi-sheet .xlsx. Owner / Admin / Accountant only.
export async function GET(req: Request) {
  const ctx = await requireStaff();
  if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(ctx.role)) {
    return new Response("Not allowed.", { status: 403 });
  }

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  let academicYearId: string | undefined;
  if (yearParam && yearParam !== "all") {
    const year = await db.query.academicYears.findFirst({
      where: and(eq(academicYears.id, yearParam), eq(academicYears.schoolId, ctx.schoolId)),
    });
    if (year) academicYearId = year.id;
  }

  const { bytes, filename } = await buildExportWorkbook(ctx.schoolId, academicYearId);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
