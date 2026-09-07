import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireStaff, can } from "@/lib/session";
import { resolveYear } from "@/lib/academic";
import { listPayments } from "@/lib/payments";
import { getTranslator, enumLabel, type Locale } from "@/lib/i18n";
import { formatEgpExact } from "@/lib/money";
import { fullName } from "@/lib/students";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const ctx = await requireStaff();
  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const sp = await searchParams;
  const { active } = await resolveYear(ctx.schoolId, sp.year);

  const rows = await listPayments(ctx.schoolId, active?.id ?? null, 200);
  const total = rows.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav_payments")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("payments_subtitle")} · {rows.length} · {formatEgpExact(total)}
          </p>
        </div>
        {can(ctx.role, "payments") && (
          <Button nativeButton={false} render={<Link href="/dashboard/payments/new" />}>
            <Wallet className="h-4 w-4" /> {t("new_payment")}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("receipt_no")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("student")}</TableHead>
                <TableHead>{t("allocated_to")}</TableHead>
                <TableHead>{t("method")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">{t("no_data_yet")}</TableCell></TableRow>
              )}
              {rows.map((p) => {
                const items = [...new Set(p.allocations.map((a) => a.studentFee.feeItem.name))].join(", ");
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/dashboard/payments/${p.id}`} className="hover:underline">{p.receiptNumber}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.paidOn}</TableCell>
                    <TableCell className="font-ar">{fullName(p.student)}</TableCell>
                    <TableCell className="text-muted-foreground">{items || <span className="text-amber-600">unallocated</span>}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(locale, p.method)}</Badge></TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatEgpExact(p.amount)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
