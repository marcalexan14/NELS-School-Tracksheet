import { and, desc, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  installments,
  paymentAllocations,
  payments,
  studentFees,
} from "@/db/schema";
import { fromPiastres, toPiastres } from "@/lib/money";

// Receipt numbers: RC-<year start>-<zero-padded sequence>, e.g. RC-2025-000418.
export async function nextReceiptNumber(schoolId: string, yearStart: number): Promise<string> {
  const prefix = `RC-${yearStart}-`;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(payments)
    .where(and(eq(payments.schoolId, schoolId), like(payments.receiptNumber, `${prefix}%`)));
  const seq = Number(row?.count ?? 0) + 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

function recomputeFeeStatus(netPiastres: number, paidPiastres: number, dueDate: string): string {
  if (paidPiastres >= netPiastres && netPiastres > 0) return "PAID";
  if (paidPiastres > 0) return "PARTIAL";
  if (new Date(dueDate) < new Date()) return "OVERDUE";
  return "PENDING";
}

function recomputeInstallmentStatus(amountPiastres: number, paidPiastres: number, dueDate: string): string {
  if (paidPiastres >= amountPiastres && amountPiastres > 0) return "PAID";
  if (paidPiastres > 0) return "PARTIAL";
  if (new Date(dueDate) < new Date()) return "OVERDUE";
  return "DUE";
}

export type RecordPaymentInput = {
  schoolId: string;
  studentId: string;
  academicYearId: string;
  yearStart: number;
  amount: string;
  method: "CASH" | "INSTAPAY" | "BANK_TRANSFER" | "CHEQUE" | "CARD" | "OTHER";
  paidOn: string;
  reference?: string | null;
  note?: string | null;
  receivedByStaffId?: string | null;
  // Optional: settle a specific fee first. Otherwise oldest-due-first.
  targetFeeId?: string | null;
};

// Records a payment and spreads it across the student's open fees/instalments,
// oldest due date first. Updates every touched fee + instalment status.
export async function recordPayment(input: RecordPaymentInput) {
  const receiptNumber = await nextReceiptNumber(input.schoolId, input.yearStart);

  const [payment] = await db
    .insert(payments)
    .values({
      schoolId: input.schoolId,
      studentId: input.studentId,
      academicYearId: input.academicYearId,
      receiptNumber,
      paidOn: input.paidOn,
      method: input.method,
      amount: input.amount,
      reference: input.reference ?? null,
      note: input.note ?? null,
      receivedByStaffId: input.receivedByStaffId ?? null,
    })
    .returning();

  let remaining = toPiastres(input.amount);

  const openFees = await db.query.studentFees.findMany({
    where: and(
      eq(studentFees.studentId, input.studentId),
      eq(studentFees.academicYearId, input.academicYearId),
    ),
    with: {
      installments: { orderBy: (i, { asc }) => asc(i.sequence) },
      allocations: true,
    },
  });

  const ordered = openFees
    .map((fee) => {
      const net = toPiastres(fee.netAmount);
      const paid = fee.allocations.reduce((s, a) => s + toPiastres(a.amount), 0);
      return { fee, net, paid, open: Math.max(0, net - paid) };
    })
    .filter((f) => f.open > 0)
    .sort((a, b) => {
      if (input.targetFeeId) {
        if (a.fee.id === input.targetFeeId) return -1;
        if (b.fee.id === input.targetFeeId) return 1;
      }
      return a.fee.dueDate.localeCompare(b.fee.dueDate);
    });

  for (const entry of ordered) {
    if (remaining <= 0) break;
    const { fee } = entry;

    // Walk instalments in order; fall back to a single fee-level allocation.
    const instRows = fee.installments.length
      ? fee.installments
      : [null as null];

    let feePaidNow = 0;
    for (const inst of instRows) {
      if (remaining <= 0) break;

      if (inst) {
        const instPaid = toPiastres(inst.paidAmount);
        const instOpen = Math.max(0, toPiastres(inst.amount) - instPaid);
        if (instOpen <= 0) continue;
        const take = Math.min(instOpen, remaining);

        await db.insert(paymentAllocations).values({
          paymentId: payment.id,
          studentFeeId: fee.id,
          installmentId: inst.id,
          amount: fromPiastres(take),
        });
        const newInstPaid = instPaid + take;
        await db
          .update(installments)
          .set({
            paidAmount: fromPiastres(newInstPaid),
            status: recomputeInstallmentStatus(
              toPiastres(inst.amount),
              newInstPaid,
              inst.dueDate,
            ) as typeof inst.status,
          })
          .where(eq(installments.id, inst.id));
        remaining -= take;
        feePaidNow += take;
      } else {
        const take = Math.min(entry.open, remaining);
        await db.insert(paymentAllocations).values({
          paymentId: payment.id,
          studentFeeId: fee.id,
          amount: fromPiastres(take),
        });
        remaining -= take;
        feePaidNow += take;
      }
    }

    const totalPaid = entry.paid + feePaidNow;
    await db
      .update(studentFees)
      .set({
        status: recomputeFeeStatus(entry.net, totalPaid, fee.dueDate) as typeof fee.status,
      })
      .where(eq(studentFees.id, fee.id));
  }

  return {
    payment,
    receiptNumber,
    allocated: fromPiastres(toPiastres(input.amount) - Math.max(0, remaining)),
    unallocated: fromPiastres(Math.max(0, remaining)),
  };
}

export async function listPayments(schoolId: string, academicYearId: string | null, limit = 100) {
  return db.query.payments.findMany({
    where: academicYearId
      ? and(eq(payments.schoolId, schoolId), eq(payments.academicYearId, academicYearId))
      : eq(payments.schoolId, schoolId),
    orderBy: desc(payments.paidOn),
    limit,
    with: {
      student: true,
      receivedBy: { with: { user: true } },
      allocations: { with: { studentFee: { with: { feeItem: true } } } },
    },
  });
}

export async function getPayment(paymentId: string) {
  return db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: {
      student: true,
      school: true,
      academicYear: true,
      receivedBy: { with: { user: true } },
      allocations: {
        with: {
          studentFee: { with: { feeItem: true } },
          installment: true,
        },
      },
    },
  });
}
