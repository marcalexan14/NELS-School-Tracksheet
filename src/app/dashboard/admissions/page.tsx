import { redirect } from "next/navigation";
import { requireStaff, can } from "@/lib/session";
import { getCurrentYear } from "@/lib/academic";
import { getTranslator, enumLabel, type Locale } from "@/lib/i18n";
import { db } from "@/db";
import { gradeLevels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createStudentAction } from "@/app/actions/students";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const EGYPT_GOVERNORATES = [
  "Cairo", "Giza", "Alexandria", "Qalyubia", "Dakahlia", "Sharqia", "Gharbia",
  "Monufia", "Beheira", "Kafr El Sheikh", "Damietta", "Port Said", "Ismailia",
  "Suez", "Faiyum", "Beni Suef", "Minya", "Asyut", "Sohag", "Qena", "Luxor",
  "Aswan", "Red Sea", "New Valley", "Matrouh", "North Sinai", "South Sinai",
];

export default async function AdmissionsPage() {
  const ctx = await requireStaff();
  if (!can(ctx.role, "students")) redirect("/dashboard/students");

  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const year = await getCurrentYear(ctx.schoolId);
  const grades = await db.query.gradeLevels.findMany({
    where: eq(gradeLevels.schoolId, ctx.schoolId),
    orderBy: (g, { asc }) => asc(g.ordinal),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav_admissions")}</h1>
        <p className="text-sm text-muted-foreground">{t("admissions_subtitle")}</p>
      </div>

      <form action={createStudentAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("nav_students")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t("first_name")}</Label>
              <Input id="firstName" name="firstName" required className="font-ar" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondName">{t("second_name")}</Label>
              <Input id="secondName" name="secondName" className="font-ar" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thirdName">{t("third_name")}</Label>
              <Input id="thirdName" name="thirdName" className="font-ar" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="familyName">{t("family_name")}</Label>
              <Input id="familyName" name="familyName" required className="font-ar" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="latinName">{t("latin_name")}</Label>
              <Input id="latinName" name="latinName" placeholder="Youssef Ahmed Mohamed Ali" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationalId">{t("national_id")} <span className="text-muted-foreground">({t("optional")})</span></Label>
              <Input id="nationalId" name="nationalId" inputMode="numeric" maxLength={14} dir="ltr" placeholder="14 digits" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">{t("gender")}</Label>
              <select id="gender" name="gender" required defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                <option value="" disabled>—</option>
                <option value="MALE">{enumLabel(locale, "MALE")}</option>
                <option value="FEMALE">{enumLabel(locale, "FEMALE")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">{t("date_of_birth")}</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="religion">{t("religion")}</Label>
              <select id="religion" name="religion" defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                <option value="">—</option>
                <option value="MUSLIM">{enumLabel(locale, "MUSLIM")}</option>
                <option value="CHRISTIAN">{enumLabel(locale, "CHRISTIAN")}</option>
                <option value="OTHER">{enumLabel(locale, "OTHER")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">{t("nationality")}</Label>
              <Input id="nationality" name="nationality" defaultValue="Egyptian" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthGovernorate">{t("birth_governorate")}</Label>
              <select id="birthGovernorate" name="birthGovernorate" defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                <option value="">—</option>
                {EGYPT_GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-4">
              <Label htmlFor="address">{t("address")}</Label>
              <Input id="address" name="address" className="font-ar" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("guardian")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="guardianName">{t("guardian_name")}</Label>
              <Input id="guardianName" name="guardianName" required className="font-ar" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianRelation">{t("relation")}</Label>
              <select id="guardianRelation" name="guardianRelation" defaultValue="FATHER" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                {["FATHER", "MOTHER", "GRANDPARENT", "LEGAL_GUARDIAN", "OTHER"].map((r) => (
                  <option key={r} value={r}>{enumLabel(locale, r)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianPhone">{t("phone")}</Label>
              <Input id="guardianPhone" name="guardianPhone" dir="ltr" required placeholder="01xxxxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianEmail">Email <span className="text-muted-foreground">({t("optional")})</span></Label>
              <Input id="guardianEmail" name="guardianEmail" type="email" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianOccupation">{t("occupation")}</Label>
              <Input id="guardianOccupation" name="guardianOccupation" className="font-ar" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("nav_enrollments")} <span className="text-muted-foreground">({t("optional")})</span></CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enrollNow" className="h-4 w-4" defaultChecked={!!year} disabled={!year} />
              {year ? `Enrol into ${year.name} now` : "No academic year set yet"}
            </label>
            <div className="space-y-2">
              <Label htmlFor="gradeLevelId">{t("grade")}</Label>
              <select id="gradeLevelId" name="gradeLevelId" defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                <option value="">—</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{locale === "ar" ? g.nameAr : g.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="previousSchool">{t("previous_school")}</Label>
              <Input id="previousSchool" name="previousSchool" className="font-ar" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg">{t("save_student")}</Button>
        </div>
      </form>
    </div>
  );
}
