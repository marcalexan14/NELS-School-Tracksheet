"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, students } from "@/db/schema";
import { requireCan } from "@/lib/session";
import { recordPayment } from "@/lib/payments";

export async function recordPaymentAction(formData: FormData) {
  const ctx = await requireCan("payments");

  const studentId = String(formData.get("studentId") ?? "");
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "CASH");
  const paidOn = String(formData.get("paidOn") ?? new Date().toISOString().slice(0, 10));
  const targetFeeId = String(formData.get("targetFeeId") ?? "");

  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount above zero.");

  const [student, year] = await Promise.all([
    db.query.students.findFirst({
      where: and(eq(students.id, studentId), eq(students.schoolId, ctx.schoolId)),
    }),
    db.query.academicYears.findFirst({
      where: and(eq(academicYears.id, academicYearId), eq(academicYears.schoolId, ctx.schoolId)),
    }),
  ]);
  if (!student) throw new Error("Unknown student.");
  if (!year) throw new Error("Unknown academic year.");

  const validMethods = ["CASH", "INSTAPAY", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"];
  if (!validMethods.includes(method)) throw new Error("Invalid payment method.");

  const { payment } = await recordPayment({
    schoolId: ctx.schoolId,
    studentId,
    academicYearId,
    yearStart: Number(year.name.slice(0, 4)),
    amount: amount.toFixed(2),
    method: method as "CASH",
    paidOn,
    reference: String(formData.get("reference") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
    receivedByStaffId: ctx.staffId,
    targetFeeId: targetFeeId || null,
  });

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/students");
  revalidatePath(`/dashboard/students/${studentId}`);
  redirect(`/dashboard/payments/${payment.id}`);
}
