import Link from "next/link";
import { Wallet, TrendingUp, Percent, AlertTriangle } from "lucide-react";
import { requireStaff } from "@/lib/session";
import { resolveYear } from "@/lib/academic";
import { getDashboard } from "@/lib/reports";
import { getTranslator, type Locale } from "@/lib/i18n";
import { formatEgp, formatEgpCompact } from "@/lib/money";
import { fullName } from "@/lib/students";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { CollectionsChart } from "@/components/dashboard/collections-chart";
import { BarList } from "@/components/dashboard/bar-list";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const ctx = await requireStaff();
  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const { year } = await searchParams;
  const { active } = await resolveYear(ctx.schoolId, year);

  if (!active) {
    return (
      <EmptyYear message={t("no_data_yet")} settingsLabel={t("nav_settings")} />
    );
  }

  const data = await getDashboard(ctx.schoolId, active.id);
  const recent = await db.query.payments.findMany({
    where: and(eq(payments.schoolId, ctx.schoolId), eq(payments.academicYearId, active.id)),
    orderBy: desc(payments.paidOn),
    limit: 6,
    with: {
      student: true,
      allocations: { with: { studentFee: { with: { feeItem: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav_dashboard")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard_subtitle")} · {active.name}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("kpi_fees_billed")}
          value={formatEgpCompact(data.billed)}
          sub={`${data.studentsEnrolled.toLocaleString()} ${t("students_enrolled")}`}
          icon={<Wallet />}
          progress={100}
        />
        <StatCard
          label={t("kpi_collected")}
          value={formatEgpCompact(data.collected)}
          sub={formatEgp(data.collected)}
          icon={<TrendingUp />}
          progress={data.collectionRate}
        />
        <StatCard
          label={t("kpi_collection_rate")}
          value={`${data.collectionRate}%`}
          sub={`${formatEgpCompact(data.outstanding)} ${t("outstanding_label").toLowerCase()}`}
          icon={<Percent />}
          progress={data.collectionRate}
          progressColor="var(--brand-violet)"
        />
        <StatCard
          label={t("kpi_outstanding")}
          value={formatEgpCompact(data.outstanding)}
          sub={`${data.overdueInstallments} ${t("overdue_installments")}`}
          icon={<AlertTriangle />}
          progress={data.billed > 0 ? (data.outstanding / data.billed) * 100 : 0}
          progressColor="var(--destructive)"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("collections_by_month")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CollectionsChart data={data.byMonth} emptyLabel={t("no_data_yet")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("billed_by_stage")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              rows={data.byStage.map((s) => ({
                label: locale === "ar" ? s.nameAr : s.name,
                subLabel: locale === "ar" ? undefined : s.nameAr,
                primary: s.billed,
                secondary: s.collected,
              }))}
              emptyLabel={t("no_data_yet")}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("recent_payments")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("no_data_yet")}</p>
            ) : (
              <div className="divide-y divide-border">
                {recent.map((p) => {
                  const items = [
                    ...new Set(p.allocations.map((a) => a.studentFee.feeItem.name)),
                  ].join(", ");
                  return (
                    <Link
                      key={p.id}
                      href={`/dashboard/payments/${p.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium font-ar">{fullName(p.student)}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p.receiptNumber} · {items || "—"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-medium tabular-nums">{formatEgp(p.amount)}</div>
                        <div className="text-xs text-muted-foreground">{p.paidOn}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("outstanding_by_grade")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              rows={data.outstandingByGrade.map((g) => ({
                label: locale === "ar" ? g.nameAr : g.name,
                primary: g.outstanding,
              }))}
              primaryColor="color-mix(in oklch, var(--destructive) 55%, transparent)"
              secondaryColor="color-mix(in oklch, var(--destructive) 55%, transparent)"
              emptyLabel={t("no_data_yet")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyYear({ message, settingsLabel }: { message: string; settingsLabel: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link
        href="/dashboard/settings"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        {settingsLabel}
      </Link>
    </div>
  );
}
