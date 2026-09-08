import { requireStaff, can } from "@/lib/session";
import { resolveYear, listYears } from "@/lib/academic";
import { getTranslator, type Locale } from "@/lib/i18n";
import { fullName } from "@/lib/students";
import { db } from "@/db";
import { classrooms, enrollments, gradeLevels, students } from "@/db/schema";
import { and, eq, notInArray, sql } from "drizzle-orm";
import {
  enrollStudentAction,
  createClassroomAction,
  promoteCohortAction,
} from "@/app/actions/enrollments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RosterEditor, type RosterRow } from "@/components/enrollments/roster-editor";

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; focus?: string }>;
}) {
  const ctx = await requireStaff();
  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const editable = can(ctx.role, "enrollments");
  const sp = await searchParams;
  const { active } = await resolveYear(ctx.schoolId, sp.year);
  const years = await listYears(ctx.schoolId);

  const grades = await db.query.gradeLevels.findMany({
    where: eq(gradeLevels.schoolId, ctx.schoolId),
    orderBy: (g, { asc }) => asc(g.ordinal),
  });

  const yearClassrooms = active
    ? await db.query.classrooms.findMany({
        where: eq(classrooms.academicYearId, active.id),
        with: { gradeLevel: true },
        orderBy: (c, { asc }) => asc(c.name),
      })
    : [];

  const counts = active
    ? await db
        .select({ gradeLevelId: enrollments.gradeLevelId, n: sql<number>`count(*)` })
        .from(enrollments)
        .where(and(eq(enrollments.academicYearId, active.id), eq(enrollments.status, "ACTIVE")))
        .groupBy(enrollments.gradeLevelId)
    : [];
  const countByGrade = new Map(counts.map((c) => [c.gradeLevelId, Number(c.n)]));

  const enrolledIds = active
    ? (
        await db
          .select({ id: enrollments.studentId })
          .from(enrollments)
          .where(eq(enrollments.academicYearId, active.id))
      ).map((r) => r.id)
    : [];
  const unenrolled = active
    ? await db.query.students.findMany({
        where: and(
          eq(students.schoolId, ctx.schoolId),
          notInArray(students.status, ["GRADUATED", "WITHDRAWN", "TRANSFERRED"]),
          enrolledIds.length ? notInArray(students.id, enrolledIds) : undefined,
        ),
        orderBy: (s, { asc }) => [asc(s.familyName), asc(s.firstName)],
        limit: 300,
      })
    : [];

  // The full roster for the active year (including withdrawn, so they can be
  // reinstated) — fed to the client-side editor.
  const rosterRaw = active
    ? await db.query.enrollments.findMany({
        where: eq(enrollments.academicYearId, active.id),
        with: { student: true },
        limit: 2000,
      })
    : [];
  const roster: RosterRow[] = rosterRaw
    .map((e) => ({
      id: e.id,
      code: e.student.code,
      name: fullName(e.student),
      gradeLevelId: e.gradeLevelId,
      classroomId: e.classroomId,
      status: e.status as RosterRow["status"],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));

  const rosterLabels = {
    search: t("search_students"),
    allGrades: t("all_grades"),
    allClasses: t("all_classes"),
    unassigned: t("unassigned"),
    selected: t("selected_count"),
    moveTo: t("move_to_class"),
    move: t("move"),
    clear: t("cancel"),
    code: t("student_code"),
    name: t("student_name"),
    grade: t("grade"),
    classroom: t("classroom"),
    status: t("status"),
    actions: t("actions"),
    none: t("no_students"),
    edit: t("edit"),
    save: t("save"),
    cancel: t("cancel"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav_enrollments")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("enrollments_subtitle")}{active ? ` · ${active.name}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {grades.map((g) => (
          <div key={g.id} className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">{locale === "ar" ? g.nameAr : g.name}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{countByGrade.get(g.id) ?? 0}</div>
          </div>
        ))}
      </div>

      {active && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{active.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RosterEditor
              rows={roster}
              grades={grades.map((g) => ({ id: g.id, name: g.name, nameAr: g.nameAr, ordinal: g.ordinal }))}
              classrooms={yearClassrooms.map((c) => ({ id: c.id, name: c.name, gradeLevelId: c.gradeLevelId }))}
              editable={editable}
              locale={locale}
              labels={rosterLabels}
              initialSearch={sp.focus ?? ""}
            />
          </CardContent>
        </Card>
      )}

      {editable && active && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("enroll_student")}</CardTitle></CardHeader>
          <CardContent>
            <form action={enrollStudentAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
              <input type="hidden" name="academicYearId" value={active.id} />
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="studentId">{t("student")}</Label>
                <select id="studentId" name="studentId" required defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                  <option value="" disabled>—</option>
                  {unenrolled.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} · {fullName(s)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gradeLevelId">{t("grade")}</Label>
                <select id="gradeLevelId" name="gradeLevelId" required defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                  <option value="" disabled>—</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>{locale === "ar" ? g.nameAr : g.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="classroomId">{t("classroom")}</Label>
                <select id="classroomId" name="classroomId" defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                  <option value="">{t("unassigned")}</option>
                  {yearClassrooms.map((c) => (
                    <option key={c.id} value={c.id}>{(locale === "ar" ? c.gradeLevel.nameAr : c.gradeLevel.name)} · {c.name}</option>
                  ))}
                </select>
              </div>
              <Button type="submit">{t("enroll_student")}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {editable && active && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("classroom")}s</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <form action={createClassroomAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                <input type="hidden" name="academicYearId" value={active.id} />
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="c-grade">{t("grade")}</Label>
                  <select id="c-grade" name="gradeLevelId" required defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                    <option value="" disabled>—</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>{locale === "ar" ? g.nameAr : g.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-name">Name</Label>
                  <Input id="c-name" name="name" placeholder="1-A" required />
                </div>
                <Button type="submit">{t("save")}</Button>
              </form>
              <ul className="divide-y divide-border text-sm">
                {yearClassrooms.map((c) => (
                  <li key={c.id} className="flex justify-between py-1.5">
                    <span>{(locale === "ar" ? c.gradeLevel.nameAr : c.gradeLevel.name)} · {c.name}</span>
                    <span className="text-muted-foreground">cap {c.capacity}</span>
                  </li>
                ))}
                {yearClassrooms.length === 0 && <li className="py-2 text-muted-foreground">—</li>}
              </ul>
            </CardContent>
          </Card>
        )}

        {editable && years.length >= 2 && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("promote_cohort")}</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">{t("promote_help")}</p>
              <form action={promoteCohortAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="fromYearId">From</Label>
                  <select id="fromYearId" name="fromYearId" defaultValue={active?.id} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                    {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="toYearId">To</Label>
                  <select id="toYearId" name="toYearId" defaultValue={years[0]?.id} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                    {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                </div>
                <Button type="submit" variant="outline">{t("promote_cohort")}</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
