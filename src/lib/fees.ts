import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  enrollments,
  feePlanLines,
  feePlans,
  installments,
  studentFees,
  discounts,
} from "@/db/schema";
import { fromPiastres, toPiastres } from "@/lib/money";

// Spreads a total across `count` instalments in whole piastres, putting any
// rounding remainder on the first instalment so the parts always sum to total.
export function splitInstallments(totalPiastres: number, count: number): number[] {
  if (count <= 1) return [totalPiastres];
  const base = Math.floor(totalPiastres / count);
  const parts = Array<number>(count).fill(base);
  parts[0] += totalPiastres - base * count;
  return parts;
}

// Due dates: first instalment on the year start, the rest monthly after it.
function installmentDueDates(yearStart: string, count: number): string[] {
  const start = new Date(yearStart + "T00:00:00Z");
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + i);
    return d.toISOString().slice(0, 10);
  });
}

type DiscountRow = typeof discounts.$inferSelect;

// Discount applied to one fee line, in piastres, capped at the gross.
function discountForLine(
  grossPiastres: number,
  category: string,
  studentDiscounts: DiscountRow[],
): { amount: number; reason: string | null } {
  let total = 0;
  const reasons: string[] = [];
  for (const d of studentDiscounts) {
    if (d.appliesToCategory && d.appliesToCategory !== category) continue;
    const value =
      d.basis === "PERCENT"
        ? Math.round((grossPiastres * Number(d.value)) / 100)
        : toPiastres(d.value);
    if (value <= 0) continue;
    total += value;
    reasons.push(d.kind);
  }
  total = Math.min(total, grossPiastres);
  return { amount: total, reason: reasons.length ? reasons.join(", ") : null };
}

export type BillRunResult = {
  studentsBilled: number;
  feesCreated: number;
  skipped: number;
};

// Creates student_fees (+ instalments) for every ACTIVE enrolment in the year
// that doesn't already have them. Idempotent: re-running only fills gaps.
export async function generateBillsForYear(
  schoolId: string,
  academicYearId: string,
  yearStart: string,
): Promise<BillRunResult> {
  const activeEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.schoolId, schoolId),
      eq(enrollments.academicYearId, academicYearId),
      eq(enrollments.status, "ACTIVE"),
    ),
  });

  const plans = await db.query.feePlans.findMany({
    where: and(
      eq(feePlans.schoolId, schoolId),
      eq(feePlans.academicYearId, academicYearId),
    ),
    with: { lines: { with: { feeItem: true } } },
  });
  const planByGrade = new Map(plans.map((p) => [p.gradeLevelId, p]));

  const existing = await db.query.studentFees.findMany({
    where: eq(studentFees.academicYearId, academicYearId),
    columns: { enrollmentId: true, feeItemId: true },
  });
  const existingKey = new Set(existing.map((e) => `${e.enrollmentId}:${e.feeItemId}`));

  const allDiscounts = await db.query.discounts.findMany({
    where: eq(discounts.academicYearId, academicYearId),
  });
  const discountsByStudent = new Map<string, DiscountRow[]>();
  for (const d of allDiscounts) {
    const list = discountsByStudent.get(d.studentId) ?? [];
    list.push(d);
    discountsByStudent.set(d.studentId, list);
  }

  let studentsBilled = 0;
  let feesCreated = 0;
  let skipped = 0;

  for (const enr of activeEnrollments) {
    const plan = planByGrade.get(enr.gradeLevelId);
    if (!plan) {
      skipped += 1;
      continue;
    }

    let createdForStudent = false;
    const studentDiscounts = discountsByStudent.get(enr.studentId) ?? [];

    for (const line of plan.lines) {
      if (!line.mandatory) continue;
      if (existingKey.has(`${enr.id}:${line.feeItemId}`)) continue;

      const grossPiastres = toPiastres(line.amount);
      const { amount: discountPiastres, reason } = discountForLine(
        grossPiastres,
        line.feeItem.category,
        studentDiscounts,
      );
      const netPiastres = grossPiastres - discountPiastres;
      const splitCount = line.splitIntoInstallments ? Math.max(1, plan.installmentCount) : 1;

      const [fee] = await db
        .insert(studentFees)
        .values({
          schoolId,
          studentId: enr.studentId,
          enrollmentId: enr.id,
          academicYearId,
          feeItemId: line.feeItemId,
          grossAmount: line.amount,
          discountAmount: fromPiastres(discountPiastres),
          discountReason: reason,
          netAmount: fromPiastres(netPiastres),
          dueDate: yearStart,
          status: "PENDING",
        })
        .returning();

      const parts = splitInstallments(netPiastres, splitCount);
      const dates = installmentDueDates(yearStart, splitCount);
      await db.insert(installments).values(
        parts.map((p, i) => ({
          studentFeeId: fee.id,
          sequence: i + 1,
          dueDate: dates[i],
          amount: fromPiastres(p),
          status: "DUE" as const,
        })),
      );

      feesCreated += 1;
      createdForStudent = true;
    }

    if (createdForStudent) studentsBilled += 1;
  }

  return { studentsBilled, feesCreated, skipped };
}

// A student's ledger for a year: each fee with paid/remaining, plus totals.
export async function getStudentLedger(studentId: string, academicYearId: string) {
  const fees = await db.query.studentFees.findMany({
    where: and(
      eq(studentFees.studentId, studentId),
      eq(studentFees.academicYearId, academicYearId),
    ),
    with: {
      feeItem: true,
      installments: { orderBy: (i, { asc }) => asc(i.sequence) },
      allocations: true,
    },
  });

  let net = 0;
  let paid = 0;
  const lines = fees.map((fee) => {
    const feeNet = toPiastres(fee.netAmount);
    const feePaid = fee.allocations.reduce((s, a) => s + toPiastres(a.amount), 0);
    net += feeNet;
    paid += feePaid;
    return {
      id: fee.id,
      feeItem: fee.feeItem,
      gross: fee.grossAmount,
      discount: fee.discountAmount,
      net: fee.netAmount,
      paid: fromPiastres(feePaid),
      remaining: fromPiastres(Math.max(0, feeNet - feePaid)),
      status: fee.status,
      dueDate: fee.dueDate,
      installments: fee.installments,
    };
  });

  return {
    lines,
    totals: {
      net: fromPiastres(net),
      paid: fromPiastres(paid),
      remaining: fromPiastres(Math.max(0, net - paid)),
    },
  };
}

export async function feePlanForGrade(academicYearId: string, gradeLevelId: string) {
  return db.query.feePlans.findFirst({
    where: and(
      eq(feePlans.academicYearId, academicYearId),
      eq(feePlans.gradeLevelId, gradeLevelId),
    ),
    with: { lines: { with: { feeItem: true } } },
  });
}

export { feePlanLines, inArray };
