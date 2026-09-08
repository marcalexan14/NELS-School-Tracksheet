import Link from "next/link";
import { UserPlus, FileSpreadsheet } from "lucide-react";
import { requireStaff, can } from "@/lib/session";
import { resolveYear } from "@/lib/academic";
import { listStudents } from "@/lib/students";
import { getTranslator, enumLabel, type Locale } from "@/lib/i18n";
import { formatEgpExact } from "@/lib/money";
import { db } from "@/db";
import { gradeLevels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { StudentFilters } from "@/components/students/student-filters";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ENROLLED: "default",
  APPLICANT: "secondary",
  GRADUATED: "outline",
  WITHDRAWN: "destructive",
  TRANSFERRED: "outline",
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; q?: string; grade?: string; status?: string }>;
}) {
  const ctx = await requireStaff();
  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const sp = await searchParams;
  const { active } = await resolveYear(ctx.schoolId, sp.year);

  const grades = await db.query.gradeLevels.findMany({
    where: eq(gradeLevels.schoolId, ctx.schoolId),
    orderBy: (g, { asc }) => asc(g.ordinal),
  });

  const rows = await listStudents(ctx.schoolId, active?.id ?? null, {
    search: sp.q,
    gradeLevelId: sp.grade,
    status: sp.status,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav_students")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("students_subtitle")} · {rows.length.toLocaleString()}
          </p>
        </div>
        {can(ctx.role, "students") && (
          <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/students/import" />}>
              <FileSpreadsheet className="h-4 w-4" />
              {t("import_excel")}
            </Button>
            <Button nativeButton={false} render={<Link href="/dashboard/admissions" />}>
              <UserPlus className="h-4 w-4" />
              {t("add_student")}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <StudentFilters
            grades={grades.map((g) => ({ id: g.id, label: locale === "ar" ? g.nameAr : g.name }))}
            statuses={["ENROLLED", "APPLICANT", "GRADUATED", "WITHDRAWN", "TRANSFERRED"].map((s) => ({
              value: s,
              label: enumLabel(locale, s),
            }))}
            placeholder={t("search_students")}
            allGradesLabel={t("all_grades")}
            allStatusesLabel={t("all_statuses")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("student_code")}</TableHead>
                <TableHead>{t("student_name")}</TableHead>
                <TableHead>{t("grade")}</TableHead>
                <TableHead>{t("classroom")}</TableHead>
                <TableHead>{t("guardian")}</TableHead>
                <TableHead className="text-right">{t("balance")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {t("no_students")}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((s) => (
                <TableRow key={s.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    <Link href={`/dashboard/students/${s.id}`}>{s.code}</Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/students/${s.id}`} className="font-medium font-ar hover:underline">
                      {s.name}
                    </Link>
                    {s.latinName && <div className="text-xs text-muted-foreground">{s.latinName}</div>}
                  </TableCell>
                  <TableCell>{locale === "ar" ? s.gradeNameAr ?? "—" : s.gradeName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.classroomName ?? "—"}</TableCell>
                  <TableCell>
                    <div className="font-ar text-sm">{s.primaryGuardian ?? "—"}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{s.primaryPhone ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={Number(s.balance) > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
                      {formatEgpExact(s.balance)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>
                      {enumLabel(locale, s.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
