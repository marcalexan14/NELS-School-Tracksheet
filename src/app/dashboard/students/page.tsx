import Link from "next/link";
import { Search, UserPlus, FileSpreadsheet } from "lucide-react";
import { requireStaff, can } from "@/lib/session";
import { resolveYear } from "@/lib/academic";
import { listStudents } from "@/lib/students";
import { getTranslator, enumLabel, type Locale } from "@/lib/i18n";
import { formatEgpExact } from "@/lib/money";
import { db } from "@/db";
import { gradeLevels } from "@/db/schema";
import { eq } from "drizzle-orm";
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
          <form method="get" className="flex flex-wrap items-end gap-3">
            {sp.year && <input type="hidden" name="year" value={sp.year} />}
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder={t("search_students")}
                className="h-9 w-full rounded-md border border-border bg-background ps-8 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <select name="grade" defaultValue={sp.grade ?? ""} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
              <option value="">{t("all_grades")}</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {locale === "ar" ? g.nameAr : g.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
              <option value="">{t("all_statuses")}</option>
              {["ENROLLED", "APPLICANT", "GRADUATED", "WITHDRAWN", "TRANSFERRED"].map((s) => (
                <option key={s} value={s}>{enumLabel(locale, s)}</option>
              ))}
            </select>
            <Button type="submit" variant="outline">{t("search_students").split(" ")[0]}</Button>
          </form>
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
