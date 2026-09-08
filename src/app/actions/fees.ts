"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  academicYears,
  feeItems,
  feePlanLines,
  feePlans,
  installments,
  studentFees,
} from "@/db/schema";
import { requireCan } from "@/lib/session";
import { generateBillsForYear, splitInstallments } from "@/lib/fees";
import { formatEgpExact, fromPiastres, toPiastres } from "@/lib/money";

const FEE_CATEGORIES = [
  "TUITION",
  "REGISTRATION",
  "TRANSPORT",
  "BOOKS",
  "UNIFORM",
  "ACTIVITIES",
  "EXAMS",
  "MEALS",
  "OTHER",
] as const;

export async function addFeeItemAction(formData: FormData) {
  const ctx = await requireCan("fees");
  const name = String(formData.get("name") ?? "").trim();
  const nameAr = String(formData.get("nameAr") ?? "").trim();
  const category = String(formData.get("category") ?? "OTHER");
  if (!name) throw new Error("Fee name is required.");
  if (!FEE_CATEGORIES.includes(category as (typeof FEE_CATEGORIES)[number])) {
    throw new Error("Invalid category.");
  }

  const existing = await db.query.feeItems.findFirst({
    where: and(eq(feeItems.schoolId, ctx.schoolId), eq(feeItems.name, name)),
  });
  if (existing) throw new Error(`A fee item named "${name}" already exists.`);

  await db.insert(feeItems).values({
    schoolId: ctx.schoolId,
    name,
    nameAr: nameAr || null,
    category: category as (typeof FEE_CATEGORIES)[number],
  });
  revalidatePath("/dashboard/fees");
}

// Upserts the whole plan for one grade/year from a set of `amount_<feeItemId>`,
// `mandatory_<feeItemId>`, and `split_<feeItemId>` fields.
export async function saveFeePlanAction(formData: FormData) {
  const ctx = await requireCan("fees");
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  const installmentCount = Math.max(1, Math.min(12, Number(formData.get("installmentCount") ?? 1)));

  const year = await db.query.academicYears.findFirst({
    where: and(eq(academicYears.id, academicYearId), eq(academicYears.schoolId, ctx.schoolId)),
  });
  if (!year) throw new Error("Unknown academic year.");

  const items = await db.query.feeItems.findMany({ where: eq(feeItems.schoolId, ctx.schoolId) });

  let plan = await db.query.feePlans.findFirst({
    where: and(eq(feePlans.academicYearId, academicYearId), eq(feePlans.gradeLevelId, gradeLevelId)),
  });
  if (!plan) {
    [plan] = await db
      .insert(feePlans)
      .values({ schoolId: ctx.schoolId, academicYearId, gradeLevelId, installmentCount })
      .returning();
  } else {
    await db.update(feePlans).set({ installmentCount }).where(eq(feePlans.id, plan.id));
    await db.delete(feePlanLines).where(eq(feePlanLines.feePlanId, plan.id));
  }

  const lines = items
    .map((item) => {
      const amount = Number(formData.get(`amount_${item.id}`) ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return {
        feePlanId: plan!.id,
        feeItemId: item.id,
        amount: amount.toFixed(2),
        mandatory: formData.get(`mandatory_${item.id}`) === "on",
        splitIntoInstallments:
          item.category === "TUITION" || formData.get(`split_${item.id}`) === "on",
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (lines.length) await db.insert(feePlanLines).values(lines);

  revalidatePath("/dashboard/fees");
}

export async function generateBillsAction(formData: FormData) {
  const ctx = await requireCan("fees");
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const year = await db.query.academicYears.findFirst({
    where: and(eq(academicYears.id, academicYearId), eq(academicYears.schoolId, ctx.schoolId)),
  });
  if (!year) throw new Error("Unknown academic year.");

  const result = await generateBillsForYear(ctx.schoolId, academicYearId, year.startDate);

  revalidatePath("/dashboard/fees");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/students");
  redirect(
    `/dashboard/fees?year=${academicYearId}&billed=${result.feesCreated}&students=${result.studentsBilled}`,
  );
}

export type AdjustState = { ok: boolean; error?: string };

// A special case: set one student's charge for a fee to a different amount, or
// take a % / fixed discount off it. Recomputes the unpaid instalments so what
// the family still owes matches the new figure. Cannot drop the amount below
// what they've already paid toward that fee.
export async function adjustStudentFeeAction(
  _prev: AdjustState,
  formData: FormData,
): Promise<AdjustState> {
  const ctx = await requireCan("fees");
  const studentFeeId = String(formData.get("studentFeeId") ?? "");
  const mode = String(formData.get("mode") ?? "set"); // set | percent | amount_off
  const value = Number(formData.get("value") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();

  if (!Number.isFinite(value) || value < 0) return { ok: false, error: "Enter a value of zero or more." };

  const fee = await db.query.studentFees.findFirst({
    where: and(eq(studentFees.id, studentFeeId), eq(studentFees.schoolId, ctx.schoolId)),
    with: {
      installments: { orderBy: (i, { asc }) => asc(i.sequence) },
      allocations: true,
      feeItem: true,
    },
  });
  if (!fee) return { ok: false, error: "Unknown charge." };

  const gross = toPiastres(fee.grossAmount);
  let net: number;
  if (mode === "percent") {
    if (value > 100) return { ok: false, error: "A percentage can't exceed 100." };
    net = Math.round(gross * (1 - value / 100));
  } else if (mode === "amount_off") {
    net = Math.max(0, gross - toPiastres(value));
  } else {
    net = toPiastres(value); // exact amount
  }

  const paid = fee.allocations.reduce((s, a) => s + toPiastres(a.amount), 0);
  if (net < paid) {
    return {
      ok: false,
      error: `The family has already paid ${formatEgpExact(fromPiastres(paid))} toward ${fee.feeItem.name}; the new amount can't be lower than that.`,
    };
  }

  const discount = gross - net; // negative = surcharge
  await db
    .update(studentFees)
    .set({
      netAmount: fromPiastres(net),
      discountAmount: fromPiastres(discount),
      discountReason: reason || (discount > 0 ? "Adjusted" : discount < 0 ? "Surcharge" : null),
      status: net === 0 ? "WAIVED" : paid >= net ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING",
    })
    .where(eq(studentFees.id, fee.id));

  // Rebuild instalments: keep any that are fully paid, spread the rest of the
  // new balance across the remaining slots (or one slot if there were none).
  const kept = fee.installments.filter((i) => i.status === "PAID");
  const keptPaid = kept.reduce((s, i) => s + toPiastres(i.paidAmount), 0);
  const toRemove = fee.installments.filter((i) => i.status !== "PAID");

  await db.delete(installments).where(eq(installments.studentFeeId, fee.id));

  const tailRemaining = Math.max(0, net - keptPaid);
  const slots = Math.max(1, toRemove.length || 1);
  const parts = splitInstallments(tailRemaining, slots);
  const rows = [
    ...kept.map((i, idx) => ({
      studentFeeId: fee.id,
      sequence: idx + 1,
      dueDate: i.dueDate,
      amount: i.amount,
      paidAmount: i.paidAmount,
      status: "PAID" as const,
    })),
    ...parts.map((p, idx) => ({
      studentFeeId: fee.id,
      sequence: kept.length + idx + 1,
      dueDate: toRemove[idx]?.dueDate ?? fee.dueDate,
      amount: fromPiastres(p),
      paidAmount: "0",
      status: "DUE" as const,
    })),
  ];
  if (rows.length) await db.insert(installments).values(rows);

  revalidatePath(`/dashboard/students/${fee.studentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}
