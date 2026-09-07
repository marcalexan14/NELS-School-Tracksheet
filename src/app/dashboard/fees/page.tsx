import Link from "next/link";
import { requireStaff, can } from "@/lib/session";
import { resolveYear } from "@/lib/academic";
import { feePlanForGrade } from "@/lib/fees";
import { getTranslator, enumLabel, type Locale } from "@/lib/i18n";
import { formatEgpExact } from "@/lib/money";
import { db } from "@/db";
import { feeItems, feePlans, gradeLevels, studentFees } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { addFeeItemAction, saveFeePlanAction, generateBillsAction } from "@/app/actions/fees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const FEE_CATEGORIES = [
  "TUITION", "REGISTRATION", "TRANSPORT", "BOOKS", "UNIFORM", "ACTIVITIES", "EXAMS", "MEALS", "OTHER",
] as const;

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; grade?: string }>;
}) {
  const ctx = await requireStaff();
  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const editable = can(ctx.role, "fees");
  const sp = await searchParams;
  const { active } = await resolveYear(ctx.schoolId, sp.year);

  const items = await db.query.feeItems.findMany({
    where: eq(feeItems.schoolId, ctx.schoolId),
    orderBy: (f, { asc }) => asc(f.name),
  });
  const grades = await db.query.gradeLevels.findMany({
    where: eq(gradeLevels.schoolId, ctx.schoolId),
    orderBy: (g, { asc }) => asc(g.ordinal),
  });

  const selectedGradeId = sp.grade || grades[0]?.id;
  const plan = active && selectedGradeId ? await feePlanForGrade(active.id, selectedGradeId) : null;
  const lineByItem = new Map((plan?.lines ?? []).map((l) => [l.feeItemId, l]));

  // Which grades already have a plan for the active year.
  const plannedGradeIds = active
    ? new Set(
        (
          await db
            .select({ gradeLevelId: feePlans.gradeLevelId })
            .from(feePlans)
            .where(eq(feePlans.academicYearId, active.id))
        ).map((r) => r.gradeLevelId),
      )
    : new Set<string>();

  const [billedRow] = active
    ? await db
        .select({ n: sql<number>`count(*)`, total: sql<string>`coalesce(sum(${studentFees.netAmount}),0)` })
        .from(studentFees)
        .where(eq(studentFees.academicYearId, active.id))
    : [{ n: 0, total: "0" }];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav_fees")}</h1>
        <p className="text-sm text-muted-foreground">{t("fees_subtitle")}{active ? ` · ${active.name}` : ""}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("fee_items")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {items.map((i) => (
              <span key={i.id} className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-sm">
                {i.name}
                {i.nameAr && <span className="font-ar text-xs text-muted-foreground">{i.nameAr}</span>}
                <Badge variant="secondary" className="text-[10px]">{enumLabel(locale, i.category)}</Badge>
              </span>
            ))}
            {items.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
          </div>
          {editable && (
            <form action={addFeeItemAction} className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-4 sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="f-name">Name</Label>
                <Input id="f-name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-nameAr">Arabic name</Label>
                <Input id="f-nameAr" name="nameAr" className="font-ar" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-category">{t("category")}</Label>
                <select id="f-category" name="category" defaultValue="OTHER" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                  {FEE_CATEGORIES.map((c) => <option key={c} value={c}>{enumLabel(locale, c)}</option>)}
                </select>
              </div>
              <Button type="submit">{t("add_fee_item")}</Button>
            </form>
          )}
        </CardContent>
      </Card>

      {active && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("fee_plans")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {grades.map((g) => (
                <Link
                  key={g.id}
                  href={`/dashboard/fees?${sp.year ? `year=${sp.year}&` : ""}grade=${g.id}`}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                    g.id === selectedGradeId ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {locale === "ar" ? g.nameAr : g.name}
                  {plannedGradeIds.has(g.id) && " ✓"}
                </Link>
              ))}
            </div>

            {selectedGradeId && (
              <form action={saveFeePlanAction} key={selectedGradeId} className="space-y-3">
                <input type="hidden" name="academicYearId" value={active.id} />
                <input type="hidden" name="gradeLevelId" value={selectedGradeId} />
                <div className="flex items-end gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="installmentCount">{t("installments")}</Label>
                    <Input
                      id="installmentCount"
                      name="installmentCount"
                      type="number"
                      min={1}
                      max={12}
                      defaultValue={plan?.installmentCount ?? 4}
                      className="w-24"
                      disabled={!editable}
                    />
                  </div>
                  <p className="pb-2 text-xs text-muted-foreground">
                    {t("plan_for")} {locale === "ar" ? grades.find((g) => g.id === selectedGradeId)?.nameAr : grades.find((g) => g.id === selectedGradeId)?.name}
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("fee_item")}</TableHead>
                      <TableHead className="w-40 text-right">{t("amount")} (EGP)</TableHead>
                      <TableHead className="w-24 text-center">{t("mandatory")}</TableHead>
                      <TableHead className="w-24 text-center">{t("installments")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const line = lineByItem.get(item.id);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.name}
                            {item.nameAr && <span className="ms-1.5 font-ar text-xs text-muted-foreground">{item.nameAr}</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              name={`amount_${item.id}`}
                              type="number"
                              min={0}
                              step="0.01"
                              defaultValue={line ? Number(line.amount) : ""}
                              className="ms-auto w-32 text-right"
                              disabled={!editable}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input type="checkbox" name={`mandatory_${item.id}`} defaultChecked={line ? line.mandatory : true} className="h-4 w-4" disabled={!editable} />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              name={`split_${item.id}`}
                              defaultChecked={line ? line.splitIntoInstallments : item.category === "TUITION"}
                              className="h-4 w-4"
                              disabled={!editable}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {editable && <Button type="submit">{t("save_changes")}</Button>}
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {active && editable && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("generate_bills")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("generate_bills_help")}</p>
            <p className="text-sm">
              {active.name}: <span className="font-medium tabular-nums">{Number(billedRow?.n ?? 0)}</span> charges ·{" "}
              <span className="font-medium tabular-nums">{formatEgpExact(billedRow?.total ?? "0")}</span> billed
            </p>
            <form action={generateBillsAction}>
              <input type="hidden" name="academicYearId" value={active.id} />
              <Button type="submit">{t("generate_bills")}</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
