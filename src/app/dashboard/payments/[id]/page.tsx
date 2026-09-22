import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { requireStaff, can } from "@/lib/session";
import { getPayment } from "@/lib/payments";
import { getTranslator, enumLabel, type Locale } from "@/lib/i18n";
import { formatEgpExact } from "@/lib/money";
import { fullName } from "@/lib/students";
import { PrintButton } from "@/components/print-button";
import { VoidPaymentPanel } from "@/components/payments/void-payment-panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff();
  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const { id } = await params;

  const payment = await getPayment(id);
  if (!payment || payment.schoolId !== ctx.schoolId) notFound();

  const allocated = payment.allocations.reduce((s, a) => s + Number(a.amount), 0);
  const unallocated = Number(payment.amount) - allocated;
  const voided = !!payment.voidedAt;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between no-print">
        <Link href="/dashboard/payments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("nav_payments")}
        </Link>
        <div className="flex items-center gap-2">
          {!voided && can(ctx.role, "payments") && (
            <VoidPaymentPanel
              paymentId={payment.id}
              labels={{
                open: t("void_payment"),
                reason: t("void_reason"),
                reasonHint: t("void_reason_hint"),
                confirm: t("void_confirm"),
                cancel: t("cancel"),
              }}
            />
          )}
          <PrintButton label={t("print_receipt")} />
        </div>
      </div>

      {voided && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive no-print">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {t("void_banner")} {payment.voidedBy?.user?.name ? `— ${payment.voidedBy.user.name}` : ""}
            </p>
            {payment.voidReason && <p className="text-destructive/80">{payment.voidReason}</p>}
          </div>
        </div>
      )}

      <div className={`rounded-xl border border-border bg-card p-8 ${voided ? "opacity-60" : ""}`}>
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="text-lg font-semibold font-ar">{payment.school.name}</p>
            {payment.school.educationDirectorate && (
              <p className="text-xs text-muted-foreground font-ar">{payment.school.educationDirectorate}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("receipt_no")}</p>
            <p className="font-mono text-sm font-medium">{payment.receiptNumber}</p>
            {voided && <p className="text-xs font-semibold uppercase text-destructive">{t("voided_label")}</p>}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-muted-foreground">{t("student")}</dt>
          <dd className="text-right font-medium font-ar">{fullName(payment.student)}</dd>
          <dt className="text-muted-foreground">{t("student_code")}</dt>
          <dd className="text-right font-mono">{payment.student.code}</dd>
          <dt className="text-muted-foreground">{t("academic_year")}</dt>
          <dd className="text-right">{payment.academicYear.name}</dd>
          <dt className="text-muted-foreground">{t("date")}</dt>
          <dd className="text-right">{payment.paidOn}</dd>
          <dt className="text-muted-foreground">{t("method")}</dt>
          <dd className="text-right">{enumLabel(locale, payment.method)}{payment.reference ? ` · ${payment.reference}` : ""}</dd>
          {payment.receivedBy?.user?.name && (
            <>
              <dt className="text-muted-foreground">{t("received_by")}</dt>
              <dd className="text-right">{payment.receivedBy.user.name}</dd>
            </>
          )}
        </dl>

        <Table className="mt-5">
          <TableHeader>
            <TableRow>
              <TableHead>{t("allocated_to")}</TableHead>
              <TableHead className="text-right">{t("amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payment.allocations.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  {locale === "ar" ? a.studentFee.feeItem.nameAr ?? a.studentFee.feeItem.name : a.studentFee.feeItem.name}
                  {a.installment && <span className="text-muted-foreground"> · #{a.installment.sequence}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatEgpExact(a.amount)}</TableCell>
              </TableRow>
            ))}
            {!voided && unallocated > 0.005 && (
              <TableRow>
                <TableCell className="text-amber-600">Unallocated (credit on account)</TableCell>
                <TableCell className="text-right tabular-nums text-amber-600">{formatEgpExact(unallocated)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm font-medium">{t("total")}</span>
          <span className="text-lg font-semibold tabular-nums">{formatEgpExact(payment.amount)}</span>
        </div>

        {payment.note && <p className="mt-3 text-xs text-muted-foreground font-ar">{payment.note}</p>}
      </div>
    </div>
  );
}
