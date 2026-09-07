import { requireStaff, can } from "@/lib/session";
import { listYears } from "@/lib/academic";
import { db } from "@/db";
import { staff, gradeLevels, stages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTranslator, enumLabel, LOCALES, type Locale } from "@/lib/i18n";
import {
  updateSchoolAction,
  addAcademicYearAction,
  setCurrentYearAction,
  addStaffAction,
  updateStaffRoleAction,
} from "@/app/actions/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STAFF_ROLES = ["ADMIN", "REGISTRAR", "ACCOUNTANT", "TEACHER", "VIEWER"] as const;

export default async function SettingsPage() {
  const ctx = await requireStaff();
  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const editable = can(ctx.role, "settings");

  const years = await listYears(ctx.schoolId);
  const team = await db.query.staff.findMany({
    where: eq(staff.schoolId, ctx.schoolId),
    with: { user: true },
  });
  const ladder = await db
    .select({
      stageName: stages.name,
      stageNameAr: stages.nameAr,
      stageOrdinal: stages.ordinal,
      gradeName: gradeLevels.name,
      gradeNameAr: gradeLevels.nameAr,
      gradeOrdinal: gradeLevels.ordinal,
    })
    .from(gradeLevels)
    .innerJoin(stages, eq(gradeLevels.stageId, stages.id))
    .where(eq(gradeLevels.schoolId, ctx.schoolId))
    .orderBy(gradeLevels.ordinal);

  const stageGroups = Array.from(
    ladder.reduce((map, row) => {
      const g = map.get(row.stageName) ?? { nameAr: row.stageNameAr, grades: [] as typeof ladder };
      g.grades.push(row);
      map.set(row.stageName, g);
      return map;
    }, new Map<string, { nameAr: string; grades: typeof ladder }>()),
  );

  const thisYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav_settings")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings_subtitle")}</p>
      </div>

      {!editable && (
        <p className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          Your role ({enumLabel(locale, ctx.role)}) can view settings but not change them.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("school_profile")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSchoolAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">School name</Label>
              <Input id="name" name="name" defaultValue={ctx.school.name} required disabled={!editable} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortName">Short code</Label>
              <Input id="shortName" name="shortName" defaultValue={ctx.school.shortName ?? ""} maxLength={6} disabled={!editable} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locale">{t("language")}</Label>
              <select
                id="locale"
                name="locale"
                defaultValue={locale}
                disabled={!editable}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                {LOCALES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.nativeLabel}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent colour</Label>
              <Input id="accentColor" name="accentColor" type="color" defaultValue={ctx.school.accentColor} disabled={!editable} className="h-9 w-full p-1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="educationDirectorate">Education directorate (الإدارة التعليمية)</Label>
              <Input id="educationDirectorate" name="educationDirectorate" defaultValue={ctx.school.educationDirectorate ?? ""} disabled={!editable} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" name="phone" defaultValue={ctx.school.phone ?? ""} disabled={!editable} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">{t("address")}</Label>
              <Input id="address" name="address" defaultValue={ctx.school.address ?? ""} disabled={!editable} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("nav_settings")} email</Label>
              <Input id="email" name="email" type="email" defaultValue={ctx.school.email ?? ""} disabled={!editable} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={!editable}>{t("save_changes")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("academic_years")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("academic_year")}</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((y) => (
                <TableRow key={y.id}>
                  <TableCell className="font-medium">
                    {y.name}
                    {y.isCurrent && <Badge className="ms-2">{t("current")}</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{y.startDate}</TableCell>
                  <TableCell className="text-muted-foreground">{y.endDate}</TableCell>
                  <TableCell className="text-right">
                    {!y.isCurrent && editable && (
                      <form action={setCurrentYearAction}>
                        <input type="hidden" name="yearId" value={y.id} />
                        <Button type="submit" variant="ghost" size="sm">{t("make_current")}</Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {editable && (
            <form action={addAcademicYearAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
              <div className="space-y-2">
                <Label htmlFor="startYear">New year starts</Label>
                <Input id="startYear" name="startYear" type="number" defaultValue={thisYear} min={2000} max={2100} className="w-32" />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" name="makeCurrent" className="h-4 w-4" /> {t("make_current")}
              </label>
              <Button type="submit">{t("add_year")}</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("staff_members")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("student_name")}</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>{t("role")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.user.name ?? "—"}{m.title ? ` · ${m.title}` : ""}</TableCell>
                  <TableCell className="text-muted-foreground">{m.user.email}</TableCell>
                  <TableCell>
                    {m.role === "OWNER" || !editable ? (
                      <Badge variant="secondary">{enumLabel(locale, m.role)}</Badge>
                    ) : (
                      <form action={updateStaffRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="staffId" value={m.id} />
                        <select name="role" defaultValue={m.role} className="rounded-md border border-border bg-background px-2 py-1 text-sm">
                          {STAFF_ROLES.map((r) => (
                            <option key={r} value={r}>{enumLabel(locale, r)}</option>
                          ))}
                        </select>
                        <Button type="submit" variant="ghost" size="sm">{t("save")}</Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {editable && (
            <form action={addStaffAction} className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
              <div className="space-y-2">
                <Label htmlFor="s-name">Name</Label>
                <Input id="s-name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-email">Email</Label>
                <Input id="s-email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-title">Title</Label>
                <Input id="s-title" name="title" placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-role">{t("role")}</Label>
                <select id="s-role" name="role" defaultValue="ACCOUNTANT" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>{enumLabel(locale, r)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-password">Temp password</Label>
                <Input id="s-password" name="password" type="text" minLength={8} required />
              </div>
              <Button type="submit">{t("save")}</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("grade_ladder")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stageGroups.map(([name, group]) => (
              <div key={name} className="rounded-lg border border-border p-3">
                <div className="text-sm font-medium">
                  {name} <span className="font-ar text-muted-foreground">{group.nameAr}</span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {group.grades.map((g) => (
                    <li key={g.gradeName} className="flex justify-between">
                      <span>{g.gradeName}</span>
                      <span className="font-ar">{g.gradeNameAr}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
