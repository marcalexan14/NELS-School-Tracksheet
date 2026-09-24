import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { requireView, can } from "@/lib/session";
import { resolveYear } from "@/lib/academic";
import { getStudent, fullName } from "@/lib/students";
import { getStudentLedger } from "@/lib/fees";
import { getTranslator, enumLabel, type Locale } from "@/lib/i18n";
import { formatEgpExact } from "@/lib/money";
import { addGuardianAction } from "@/app/actions/students";
import { StudentFeesTable } from "@/components/students/student-fees-table";
import { EditStudentPanel } from "@/components/students/edit-student-panel";
import { GuardianCard } from "@/components/students/guardian-card";
import { DiscountsPanel } from "@/components/students/discounts-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

function OverviewFields({
  student,
  locale,
  t,
}: {
  student: {
    latinName: string | null;
    nationalId: string | null;
    dateOfBirth: string;
    gender: string;
    religion: string | null;
    nationality: string;
    birthGovernorate: string | null;
    address: string | null;
  };
  locale: Locale;
  t: ReturnType<typeof getTranslator>;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
      <Field label={t("latin_name").split(" (")[0]} value={student.latinName} />
      <Field label={t("national_id")} value={<span dir="ltr">{student.nationalId}</span>} />
      <Field label={t("date_of_birth")} value={student.dateOfBirth} />
      <Field label={t("gender")} value={enumLabel(locale, student.gender)} />
      <Field label={t("religion")} value={enumLabel(locale, student.religion)} />
      <Field label={t("nationality")} value={student.nationality} />
      <Field label={t("birth_governorate")} value={student.birthGovernorate} />
      <Field label={t("address")} value={<span className="font-ar">{student.address}</span>} />
    </dl>
  );
}

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const ctx = await requireView("students");
  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const { id } = await params;
  const { year } = await searchParams;

  const student = await getStudent(ctx.schoolId, id);
  if (!student) notFound();

  const { active } = await resolveYear(ctx.schoolId, year);
  const ledger = active ? await getStudentLedger(student.id, active.id) : null;
  const currentEnrollment = student.enrollments.find((e) => e.academicYearId === active?.id);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/students" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("nav_students")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-foreground">
            {student.firstName[0]}
            {student.familyName[0]}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight font-ar">{fullName(student)}</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{student.code}</span>
              {currentEnrollment && (
                <> · {locale === "ar" ? currentEnrollment.gradeLevel.nameAr : currentEnrollment.gradeLevel.name}
                  {currentEnrollment.classroom ? ` · ${currentEnrollment.classroom.name}` : ""}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{enumLabel(locale, student.status)}</Badge>
          {ledger && Number(ledger.totals.remaining) > 0 && can(ctx.role, "payments") && (
            <Button nativeButton={false} render={<Link href={`/dashboard/payments/new?student=${student.id}`} />}>
              <Wallet className="h-4 w-4" /> {t("record_payment")}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("tab_overview")}</TabsTrigger>
          <TabsTrigger value="guardians">{t("tab_guardians")} ({student.guardians.length})</TabsTrigger>
          <TabsTrigger value="enrollment">{t("tab_enrollment")}</TabsTrigger>
          <TabsTrigger value="fees">{t("tab_fees")}</TabsTrigger>
          <TabsTrigger value="documents">{t("tab_documents")} ({student.documents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {can(ctx.role, "students") ? (
                <EditStudentPanel
                  student={student}
                  labels={{
                    edit: t("edit_student"),
                    cancel: t("cancel"),
                    save: t("save"),
                    firstName: t("first_name"),
                    secondName: t("second_name"),
                    thirdName: t("third_name"),
                    familyName: t("family_name"),
                    latinName: t("latin_name").split(" (")[0],
                    nationalId: t("national_id"),
                    gender: t("gender"),
                    dateOfBirth: t("date_of_birth"),
                    religion: t("religion"),
                    nationality: t("nationality"),
                    birthGovernorate: t("birth_governorate"),
                    address: t("address"),
                    male: enumLabel(locale, "MALE"),
                    female: enumLabel(locale, "FEMALE"),
                    muslim: enumLabel(locale, "MUSLIM"),
                    christian: enumLabel(locale, "CHRISTIAN"),
                    other: enumLabel(locale, "OTHER"),
                  }}
                >
                  <OverviewFields student={student} locale={locale} t={t} />
                </EditStudentPanel>
              ) : (
                <OverviewFields student={student} locale={locale} t={t} />
              )}

              <DiscountsPanel
                studentId={student.id}
                currentYearId={active?.id ?? null}
                discounts={student.discounts.map((d) => ({
                  id: d.id,
                  kind: d.kind,
                  basis: d.basis,
                  value: d.value,
                  appliesToCategory: d.appliesToCategory,
                  academicYearName: d.academicYear.name,
                }))}
                locale={locale}
                labels={{
                  title: t("discount"),
                  add: t("add_discount"),
                  none: t("no_discounts"),
                  remove: t("delete_guardian"),
                  value: t("amount"),
                  note: t("adjust_reason"),
                  save: t("save"),
                  cancel: t("cancel"),
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardians" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {student.guardians.map((g) => (
              <GuardianCard
                key={g.id}
                guardian={g}
                locale={locale}
                canEdit={can(ctx.role, "students")}
                labels={{
                  name: t("guardian_name"),
                  relation: t("relation"),
                  phone: t("phone"),
                  altPhone: t("phone") + " 2",
                  occupation: t("occupation"),
                  nationalId: t("national_id"),
                  primaryContact: t("primary_contact"),
                  emergencyContact: t("emergency_contact"),
                  edit: t("edit"),
                  remove: t("delete_guardian"),
                  save: t("save"),
                  cancel: t("cancel"),
                }}
              />
            ))}
          </div>

          {can(ctx.role, "students") && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("add_guardian")}</CardTitle></CardHeader>
              <CardContent>
                <form action={addGuardianAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:items-end">
                  <input type="hidden" name="studentId" value={student.id} />
                  <div className="space-y-2">
                    <Label htmlFor="g-name">{t("guardian_name")}</Label>
                    <Input id="g-name" name="name" required className="font-ar" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="g-relation">{t("relation")}</Label>
                    <select id="g-relation" name="relation" defaultValue="MOTHER" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                      {["FATHER", "MOTHER", "GRANDPARENT", "SIBLING", "UNCLE_AUNT", "LEGAL_GUARDIAN", "OTHER"].map((r) => (
                        <option key={r} value={r}>{enumLabel(locale, r)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="g-phone">{t("phone")}</Label>
                    <Input id="g-phone" name="phone" dir="ltr" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="g-email">Email</Label>
                    <Input id="g-email" name="email" type="email" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="g-occupation">{t("occupation")}</Label>
                    <Input id="g-occupation" name="occupation" className="font-ar" />
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" name="isPrimaryContact" className="h-4 w-4" /> {t("primary_contact")}
                  </label>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" name="isEmergencyContact" className="h-4 w-4" /> {t("emergency_contact")}
                  </label>
                  <Button type="submit">{t("add_guardian")}</Button>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="enrollment" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("academic_year")}</TableHead>
                    <TableHead>{t("grade")}</TableHead>
                    <TableHead>{t("classroom")}</TableHead>
                    <TableHead>{t("enrolment_date")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {student.enrollments.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">—</TableCell></TableRow>
                  )}
                  {student.enrollments.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.academicYear.name}</TableCell>
                      <TableCell>{locale === "ar" ? e.gradeLevel.nameAr : e.gradeLevel.name}</TableCell>
                      <TableCell className="text-muted-foreground">{e.classroom?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.enrollmentDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{enumLabel(locale, e.status)}</Badge>
                          {can(ctx.role, "enrollments") && (
                            <Link
                              href={`/dashboard/enrollments?year=${e.academicYearId}&focus=${student.code}`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              {t("edit")}
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="mt-4 space-y-4">
          {!ledger || ledger.lines.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{t("no_data_yet")}</CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">{t("net")}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatEgpExact(ledger.totals.net)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">{t("paid")}</p><p className="mt-1 text-xl font-semibold tabular-nums text-primary">{formatEgpExact(ledger.totals.paid)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">{t("remaining")}</p><p className="mt-1 text-xl font-semibold tabular-nums text-destructive">{formatEgpExact(ledger.totals.remaining)}</p></CardContent></Card>
              </div>
              <Card>
                <CardContent className="p-0">
                  <StudentFeesTable
                    canAdjust={can(ctx.role, "fees")}
                    lines={ledger.lines.map((l) => ({
                      id: l.id,
                      feeItemName: locale === "ar" ? l.feeItem.nameAr ?? l.feeItem.name : l.feeItem.name,
                      gross: l.gross,
                      discount: l.discount,
                      net: l.net,
                      paid: l.paid,
                      remaining: l.remaining,
                      status: l.status,
                      statusLabel: enumLabel(locale, l.status),
                      installmentCount: l.installments.length,
                    }))}
                    labels={{
                      fee: t("fee_item"),
                      gross: t("gross"),
                      discount: t("discount"),
                      net: t("net"),
                      paid: t("paid"),
                      remaining: t("remaining"),
                      status: t("status"),
                      installments: t("installments").toLowerCase(),
                      adjust: t("adjust_fee"),
                      how: t("adjust_how"),
                      exactAmount: t("adjust_exact"),
                      percentOff: t("adjust_percent"),
                      amountOff: t("adjust_amount_off"),
                      reason: t("adjust_reason"),
                      reasonHint: t("adjust_reason_hint"),
                      adjustHint: t("adjust_hint"),
                      save: t("save"),
                      cancel: t("cancel"),
                    }}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {student.documents.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">{t("no_data_yet")}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {student.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{enumLabel(locale, d.kind)} · {d.fileName}</span>
                      <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">View</a>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Document uploads are wired to local disk storage — configure an object store before going live.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
