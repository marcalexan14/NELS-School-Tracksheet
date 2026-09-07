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
} from "@/db/schema";
import { requireCan } from "@/lib/session";
import { generateBillsForYear } from "@/lib/fees";

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
