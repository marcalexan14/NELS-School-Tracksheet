import { requireStaff } from "@/lib/session";
import { resolveYear } from "@/lib/academic";
import { getDashboard, getReportBreakdown } from "@/lib/reports";
import { getTranslator, enumLabel, type Locale } from "@/lib/i18n";
import { formatEgpExact, formatEgpCompact } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarList } from "@/components/dashboard/bar-list";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const ctx = await requireStaff();
  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const sp = await searchParams;
  const { active } = await resolveYear(ctx.schoolId, sp.year);

  if (!active) return <p className="text-sm text-muted-foreground">{t("no_data_yet")}</p>;

  const [dash, breakdown] = await Promise.all([
    getDashboard(ctx.schoolId, active.id),
    getReportBreakdown(active.id),
  ]);

  const methodTotal = breakdown.byMethod.reduce((s, m) => s + m.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav_reports")}</h1>
        <p className="text-sm text-muted-foreground">{t("reports_subtitle")} · {active.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          [t("kpi_fees_billed"), formatEgpCompact(dash.billed)],
          [t("kpi_collected"), formatEgpCompact(dash.collected)],
          [t("kpi_outstanding"), formatEgpCompact(dash.outstanding)],
          [t("kpi_collection_rate"), `${dash.collectionRate}%`],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("income_by_stage")}</CardTitle></CardHeader>
          <CardContent>
            <BarList
              rows={dash.byStage.map((s) => ({
                label: locale === "ar" ? s.nameAr : s.name,
                primary: s.billed,
                secondary: s.collected,
              }))}
              emptyLabel={t("no_data_yet")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("income_by_fee_type")}</CardTitle></CardHeader>
          <CardContent>
            <BarList
              rows={breakdown.byFeeType.map((f) => ({ label: f.name, primary: f.billed, secondary: f.collected }))}
              emptyLabel={t("no_data_yet")}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("income_by_grade")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("grade")}</TableHead>
                <TableHead className="text-right">{t("kpi_fees_billed")}</TableHead>
                <TableHead className="text-right">{t("kpi_collected")}</TableHead>
                <TableHead className="text-right">{t("kpi_outstanding")}</TableHead>
                <TableHead className="text-right">{t("kpi_collection_rate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.byGrade.map((g) => {
                const outstanding = Math.max(0, g.billed - g.collected);
                const rate = g.billed > 0 ? Math.round((g.collected / g.billed) * 100) : 0;
                return (
                  <TableRow key={g.name}>
                    <TableCell className="font-medium">
                      {g.name}
                      <span className="ms-1.5 font-ar text-xs text-muted-foreground">{g.nameAr}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatEgpExact(g.billed)}</TableCell>
                    <TableCell className="text-right tabular-nums text-primary">{formatEgpExact(g.collected)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{formatEgpExact(outstanding)}</TableCell>
                    <TableCell className="text-right tabular-nums">{rate}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>{t("total")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatEgpExact(dash.billed)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatEgpExact(dash.collected)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatEgpExact(dash.outstanding)}</TableCell>
                <TableCell className="text-right tabular-nums">{dash.collectionRate}%</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("collection_summary")} — {t("method")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("method")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.byMethod.map((m) => (
                <TableRow key={m.method}>
                  <TableCell>{enumLabel(locale, m.method)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEgpExact(m.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{methodTotal > 0 ? Math.round((m.total / methodTotal) * 100) : 0}%</TableCell>
                </TableRow>
              ))}
              {breakdown.byMethod.length === 0 && (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">{t("no_data_yet")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
