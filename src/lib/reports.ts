import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  enrollments,
  feeItems,
  gradeLevels,
  paymentAllocations,
  payments,
  stages,
  studentFees,
} from "@/db/schema";
import { fromPiastres, toPiastres } from "@/lib/money";

// Everything reporting-side is derived from student_fees (what's owed) and
// payment_allocations (what's been paid) — never a separate running total.

export type DashboardData = {
  billed: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  studentsEnrolled: number;
  overdueInstallments: number;
  byStage: { key: string; name: string; nameAr: string; billed: number; collected: number }[];
  byMonth: { month: string; collected: number }[];
  outstandingByGrade: { name: string; nameAr: string; outstanding: number }[];
};

export async function getDashboard(schoolId: string, academicYearId: string): Promise<DashboardData> {
  const [billedRow] = await db
    .select({ total: sql<string>`coalesce(sum(${studentFees.netAmount}), 0)` })
    .from(studentFees)
    .where(eq(studentFees.academicYearId, academicYearId));
  const billed = toPiastres(billedRow?.total ?? "0");

  const [collectedRow] = await db
    .select({ total: sql<string>`coalesce(sum(${paymentAllocations.amount}), 0)` })
    .from(paymentAllocations)
    .innerJoin(studentFees, eq(paymentAllocations.studentFeeId, studentFees.id))
    .where(eq(studentFees.academicYearId, academicYearId));
  const collected = toPiastres(collectedRow?.total ?? "0");

  const [enrolledRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      and(eq(enrollments.academicYearId, academicYearId), eq(enrollments.status, "ACTIVE")),
    );

  const [overdueRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(studentFees)
    .where(and(eq(studentFees.academicYearId, academicYearId), eq(studentFees.status, "OVERDUE")));

  // Billed per stage, joined through enrolment -> grade level -> stage.
  const byStageRows = await db
    .select({
      key: stages.key,
      name: stages.name,
      nameAr: stages.nameAr,
      ordinal: stages.ordinal,
      billed: sql<string>`coalesce(sum(${studentFees.netAmount}), 0)`,
    })
    .from(studentFees)
    .innerJoin(enrollments, eq(studentFees.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(stages, eq(gradeLevels.stageId, stages.id))
    .where(eq(studentFees.academicYearId, academicYearId))
    .groupBy(stages.key, stages.name, stages.nameAr, stages.ordinal)
    .orderBy(stages.ordinal);

  const stageCollected = await db
    .select({
      key: stages.key,
      collected: sql<string>`coalesce(sum(${paymentAllocations.amount}), 0)`,
    })
    .from(paymentAllocations)
    .innerJoin(studentFees, eq(paymentAllocations.studentFeeId, studentFees.id))
    .innerJoin(enrollments, eq(studentFees.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(stages, eq(gradeLevels.stageId, stages.id))
    .where(eq(studentFees.academicYearId, academicYearId))
    .groupBy(stages.key);
  const collectedByStage = new Map(stageCollected.map((r) => [r.key, toPiastres(r.collected)]));

  const byStage = byStageRows.map((r) => ({
    key: r.key,
    name: r.name,
    nameAr: r.nameAr,
    billed: toPiastres(r.billed) / 100,
    collected: (collectedByStage.get(r.key) ?? 0) / 100,
  }));

  // Collections per calendar month.
  const monthRows = await db
    .select({
      month: sql<string>`to_char(${payments.paidOn}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(eq(payments.academicYearId, academicYearId))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const byMonth = monthRows.map((r) => ({ month: r.month, collected: toPiastres(r.total) / 100 }));

  // Outstanding by grade (top 8).
  const gradeRows = await db
    .select({
      name: gradeLevels.name,
      nameAr: gradeLevels.nameAr,
      ordinal: gradeLevels.ordinal,
      net: sql<string>`coalesce(sum(${studentFees.netAmount}), 0)`,
      paid: sql<string>`coalesce(sum((
        select coalesce(sum(pa.amount), 0) from ${paymentAllocations} pa
        where pa.student_fee_id = ${studentFees.id}
      )), 0)`,
    })
    .from(studentFees)
    .innerJoin(enrollments, eq(studentFees.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(eq(studentFees.academicYearId, academicYearId))
    .groupBy(gradeLevels.name, gradeLevels.nameAr, gradeLevels.ordinal)
    .orderBy(gradeLevels.ordinal);
  const outstandingByGrade = gradeRows
    .map((r) => ({
      name: r.name,
      nameAr: r.nameAr,
      outstanding: Math.max(0, toPiastres(r.net) - toPiastres(r.paid)) / 100,
    }))
    .filter((r) => r.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 8);

  return {
    billed: billed / 100,
    collected: collected / 100,
    outstanding: Math.max(0, billed - collected) / 100,
    collectionRate: billed > 0 ? Math.round((collected / billed) * 1000) / 10 : 0,
    studentsEnrolled: Number(enrolledRow?.count ?? 0),
    overdueInstallments: Number(overdueRow?.count ?? 0),
    byStage,
    byMonth,
    outstandingByGrade,
  };
}

export type ReportBreakdown = {
  byFeeType: { name: string; billed: number; collected: number }[];
  byGrade: { name: string; nameAr: string; billed: number; collected: number }[];
  byMethod: { method: string; total: number }[];
};

export async function getReportBreakdown(academicYearId: string): Promise<ReportBreakdown> {
  const feeTypeBilled = await db
    .select({
      name: feeItems.name,
      billed: sql<string>`coalesce(sum(${studentFees.netAmount}), 0)`,
    })
    .from(studentFees)
    .innerJoin(feeItems, eq(studentFees.feeItemId, feeItems.id))
    .where(eq(studentFees.academicYearId, academicYearId))
    .groupBy(feeItems.name);
  const feeTypeCollected = await db
    .select({
      name: feeItems.name,
      collected: sql<string>`coalesce(sum(${paymentAllocations.amount}), 0)`,
    })
    .from(paymentAllocations)
    .innerJoin(studentFees, eq(paymentAllocations.studentFeeId, studentFees.id))
    .innerJoin(feeItems, eq(studentFees.feeItemId, feeItems.id))
    .where(eq(studentFees.academicYearId, academicYearId))
    .groupBy(feeItems.name);
  const collectedByType = new Map(feeTypeCollected.map((r) => [r.name, toPiastres(r.collected) / 100]));
  const byFeeType = feeTypeBilled.map((r) => ({
    name: r.name,
    billed: toPiastres(r.billed) / 100,
    collected: collectedByType.get(r.name) ?? 0,
  }));

  const gradeBilled = await db
    .select({
      name: gradeLevels.name,
      nameAr: gradeLevels.nameAr,
      ordinal: gradeLevels.ordinal,
      billed: sql<string>`coalesce(sum(${studentFees.netAmount}), 0)`,
    })
    .from(studentFees)
    .innerJoin(enrollments, eq(studentFees.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(eq(studentFees.academicYearId, academicYearId))
    .groupBy(gradeLevels.name, gradeLevels.nameAr, gradeLevels.ordinal)
    .orderBy(gradeLevels.ordinal);
  const gradeCollected = await db
    .select({
      name: gradeLevels.name,
      collected: sql<string>`coalesce(sum(${paymentAllocations.amount}), 0)`,
    })
    .from(paymentAllocations)
    .innerJoin(studentFees, eq(paymentAllocations.studentFeeId, studentFees.id))
    .innerJoin(enrollments, eq(studentFees.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(eq(studentFees.academicYearId, academicYearId))
    .groupBy(gradeLevels.name);
  const collectedByGrade = new Map(gradeCollected.map((r) => [r.name, toPiastres(r.collected) / 100]));
  const byGrade = gradeBilled.map((r) => ({
    name: r.name,
    nameAr: r.nameAr,
    billed: toPiastres(r.billed) / 100,
    collected: collectedByGrade.get(r.name) ?? 0,
  }));

  const methodRows = await db
    .select({
      method: payments.method,
      total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(eq(payments.academicYearId, academicYearId))
    .groupBy(payments.method);
  const byMethod = methodRows.map((r) => ({ method: r.method, total: toPiastres(r.total) / 100 }));

  return { byFeeType, byGrade, byMethod };
}

export { fromPiastres };
