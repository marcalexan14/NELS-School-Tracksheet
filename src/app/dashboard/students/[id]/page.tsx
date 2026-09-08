import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { requireStaff, can } from "@/lib/session";
import { resolveYear } from "@/lib/academic";
import { getStudent, fullName } from "@/lib/students";
import { getStudentLedger } from "@/lib/fees";
import { getTranslator, enumLabel, type Locale } from "@/lib/i18n";
import { formatEgpExact } from "@/lib/money";
import { addGuardianAction } from "@/app/actions/students";
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

const FEE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PAID: "default",
  PARTIAL: "secondary",
  PENDING: "outline",
  OVERDUE: "destructive",
  WAIVED: "outline",
};

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const ctx = await requireStaff();
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
              {student.discounts.length > 0 && (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{t("discount")}</p>
                  <ul className="space-y-1 text-sm">
                    {student.discounts.map((d) => (
                      <li key={d.id}>
                        {enumLabel(locale, d.kind)} — {d.basis === "PERCENT" ? `${d.value}%` : formatEgpExact(d.value)}
                        {d.appliesToCategory ? ` (${enumLabel(locale, d.appliesToCategory)})` : ""} · {d.academicYear.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardians" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {student.guardians.map((g) => (
              <Card key={g.id}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-medium font-ar">{g.name}</p>
                    <Badge variant="secondary">{enumLabel(locale, g.relation)}</Badge>
                  </div>
                  <dl className="mt-3 space-y-2">
                    <Field label={t("phone")} value={<span dir="ltr">{g.phone}{g.altPhone ? ` · ${g.altPhone}` : ""}</span>} />
                    <Field label="Email" value={<span dir="ltr">{g.email}</span>} />
                    <Field label={t("occupation")} value={<span className="font-ar">{g.occupation}</span>} />
                    <Field label={t("national_id")} value={<span dir="ltr">{g.nationalId}</span>} />
                  </dl>
                  <div className="mt-3 flex gap-2">
                    {g.isPrimaryContact && <Badge>{t("primary_contact")}</Badge>}
                    {g.isEmergencyContact && <Badge variant="outline">{t("emergency_contact")}</Badge>}
                  </div>
                </CardContent>
              </Card>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("fee_item")}</TableHead>
                        <TableHead className="text-right">{t("gross")}</TableHead>
                        <TableHead className="text-right">{t("discount")}</TableHead>
                        <TableHead className="text-right">{t("net")}</TableHead>
                        <TableHead className="text-right">{t("paid")}</TableHead>
                        <TableHead className="text-right">{t("remaining")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.lines.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">
                            {locale === "ar" ? l.feeItem.nameAr ?? l.feeItem.name : l.feeItem.name}
                            {l.installments.length > 1 && (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {l.installments.length} {t("installments").toLowerCase()}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{formatEgpExact(l.gross)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{Number(l.discount) > 0 ? `-${formatEgpExact(l.discount)}` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEgpExact(l.net)}</TableCell>
                          <TableCell className="text-right tabular-nums text-primary">{formatEgpExact(l.paid)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEgpExact(l.remaining)}</TableCell>
                          <TableCell><Badge variant={FEE_STATUS_VARIANT[l.status] ?? "secondary"}>{enumLabel(locale, l.status)}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
