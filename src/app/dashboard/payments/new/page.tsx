import { redirect } from "next/navigation";
import { requireStaff, can } from "@/lib/session";
import { resolveYear } from "@/lib/academic";
import { getStudentLedger } from "@/lib/fees";
import { listStudents, fullName } from "@/lib/students";
import { getTranslator, enumLabel, type Locale } from "@/lib/i18n";
import { formatEgpExact } from "@/lib/money";
import { db } from "@/db";
import { students } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { recordPaymentAction } from "@/app/actions/payments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const METHODS = ["CASH", "INSTAPAY", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"] as const;

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; student?: string }>;
}) {
  const ctx = await requireStaff();
  if (!can(ctx.role, "payments")) redirect("/dashboard/payments");

  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const sp = await searchParams;
  const { active } = await resolveYear(ctx.schoolId, sp.year);

  if (!active) {
    return <p className="text-sm text-muted-foreground">{t("no_data_yet")}</p>;
  }

  const selected = sp.student
    ? await db.query.students.findFirst({
        where: and(eq(students.id, sp.student), eq(students.schoolId, ctx.schoolId)),
      })
    : null;

  const ledger = selected ? await getStudentLedger(selected.id, active.id) : null;
  const openLines = ledger?.lines.filter((l) => Number(l.remaining) > 0) ?? [];

  // Candidate list for the picker (students with an outstanding balance first).
  const roster = await listStudents(ctx.schoolId, active.id, {});
  const withBalance = roster.filter((r) => Number(r.balance) > 0);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("new_payment")}</h1>
        <p className="text-sm text-muted-foreground">{active.name}</p>
      </div>

      {!selected ? (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("student")}</CardTitle></CardHeader>
          <CardContent>
            <form method="get" className="flex flex-wrap items-end gap-3">
              {sp.year && <input type="hidden" name="year" value={sp.year} />}
              <div className="min-w-[280px] flex-1 space-y-2">
                <Label htmlFor="student">{t("student")}</Label>
                <select id="student" name="student" required defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                  <option value="" disabled>—</option>
                  <optgroup label={t("outstanding_label")}>
                    {withBalance.map((r) => (
                      <option key={r.id} value={r.id}>{r.code} · {r.name} — {formatEgpExact(r.balance)}</option>
                    ))}
                  </optgroup>
                  <optgroup label={t("all_statuses")}>
                    {roster.filter((r) => Number(r.balance) <= 0).map((r) => (
                      <option key={r.id} value={r.id}>{r.code} · {r.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <Button type="submit">{t("back")} →</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-5">
              <p className="text-lg font-semibold font-ar">{fullName(selected)}</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">{selected.code}</span>
                {ledger && <> · {t("remaining")}: <span className="font-medium text-destructive">{formatEgpExact(ledger.totals.remaining)}</span></>}
              </p>
            </CardContent>
          </Card>

          {openLines.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("tab_fees")}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("fee_item")}</TableHead>
                      <TableHead className="text-right">{t("net")}</TableHead>
                      <TableHead className="text-right">{t("paid")}</TableHead>
                      <TableHead className="text-right">{t("remaining")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openLines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{locale === "ar" ? l.feeItem.nameAr ?? l.feeItem.name : l.feeItem.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatEgpExact(l.net)}</TableCell>
                        <TableCell className="text-right tabular-nums text-primary">{formatEgpExact(l.paid)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatEgpExact(l.remaining)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">{t("record_payment")}</CardTitle></CardHeader>
            <CardContent>
              <form action={recordPaymentAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input type="hidden" name="studentId" value={selected.id} />
                <input type="hidden" name="academicYearId" value={active.id} />
                <div className="space-y-2">
                  <Label htmlFor="amount">{t("amount")} (EGP)</Label>
                  <Input id="amount" name="amount" type="number" min="0.01" step="0.01" required
                    defaultValue={ledger ? Number(ledger.totals.remaining) || "" : ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="method">{t("method")}</Label>
                  <select id="method" name="method" defaultValue="CASH" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                    {METHODS.map((m) => <option key={m} value={m}>{enumLabel(locale, m)}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paidOn">{t("date")}</Label>
                  <Input id="paidOn" name="paidOn" type="date" defaultValue={today} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetFeeId">{t("fee_item")} <span className="text-muted-foreground">({t("optional")})</span></Label>
                  <select id="targetFeeId" name="targetFeeId" defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                    <option value="">{t("due")} — oldest first</option>
                    {openLines.map((l) => (
                      <option key={l.id} value={l.id}>{l.feeItem.name} ({formatEgpExact(l.remaining)})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference <span className="text-muted-foreground">({t("optional")})</span></Label>
                  <Input id="reference" name="reference" dir="ltr" placeholder="Cheque no. / transfer ref" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note <span className="text-muted-foreground">({t("optional")})</span></Label>
                  <Input id="note" name="note" className="font-ar" />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" size="lg">{t("record_payment")}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
