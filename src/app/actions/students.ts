"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  discounts,
  enrollments,
  guardians,
  students,
} from "@/db/schema";
import { requireCan } from "@/lib/session";
import { getCurrentYear } from "@/lib/academic";
import { nextStudentCode } from "@/lib/students";

function digits(v: FormDataEntryValue | null): string {
  return String(v ?? "").replace(/[^\d]/g, "");
}

// Registers a student plus one guardian, and (optionally) enrols them straight
// into a grade for the current year.
export async function createStudentAction(formData: FormData) {
  const ctx = await requireCan("students");

  const firstName = String(formData.get("firstName") ?? "").trim();
  const secondName = String(formData.get("secondName") ?? "").trim();
  const thirdName = String(formData.get("thirdName") ?? "").trim();
  const familyName = String(formData.get("familyName") ?? "").trim();
  const latinName = String(formData.get("latinName") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "");
  const nationalId = digits(formData.get("nationalId"));
  const nationality = String(formData.get("nationality") ?? "Egyptian").trim() || "Egyptian";
  const religion = String(formData.get("religion") ?? "");
  const birthGovernorate = String(formData.get("birthGovernorate") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!firstName || !familyName || !gender || !dateOfBirth) {
    throw new Error("First name, family name, gender, and date of birth are required.");
  }
  if (nationalId && nationalId.length !== 14) {
    throw new Error("The Egyptian national ID must be exactly 14 digits.");
  }

  const guardianName = String(formData.get("guardianName") ?? "").trim();
  const guardianPhone = String(formData.get("guardianPhone") ?? "").trim();
  const guardianRelation = String(formData.get("guardianRelation") ?? "FATHER");
  if (!guardianName || !guardianPhone) {
    throw new Error("A guardian name and phone number are required.");
  }

  const year = await getCurrentYear(ctx.schoolId);
  const startYear = year ? Number(year.name.slice(0, 4)) : new Date().getFullYear();
  const code = await nextStudentCode(ctx.schoolId, ctx.school.shortName, startYear);

  const enrollNow = formData.get("enrollNow") === "on";
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");

  const [student] = await db
    .insert(students)
    .values({
      schoolId: ctx.schoolId,
      code,
      nationalId: nationalId || null,
      firstName,
      secondName: secondName || null,
      thirdName: thirdName || null,
      familyName,
      latinName: latinName || null,
      gender: gender as "MALE" | "FEMALE",
      dateOfBirth,
      birthGovernorate: birthGovernorate || null,
      nationality,
      religion: religion ? (religion as "MUSLIM" | "CHRISTIAN" | "OTHER") : null,
      address: address || null,
      status: enrollNow && gradeLevelId && year ? "ENROLLED" : "APPLICANT",
    })
    .returning();

  await db.insert(guardians).values({
    studentId: student.id,
    relation: guardianRelation as "FATHER",
    name: guardianName,
    phone: guardianPhone,
    email: String(formData.get("guardianEmail") ?? "").trim() || null,
    occupation: String(formData.get("guardianOccupation") ?? "").trim() || null,
    isPrimaryContact: true,
    isEmergencyContact: true,
  });

  if (enrollNow && gradeLevelId && year) {
    await db.insert(enrollments).values({
      schoolId: ctx.schoolId,
      studentId: student.id,
      academicYearId: year.id,
      gradeLevelId,
      enrollmentDate: new Date().toISOString().slice(0, 10),
      previousSchool: String(formData.get("previousSchool") ?? "").trim() || null,
      status: "ACTIVE",
    });
  }

  revalidatePath("/dashboard/students");
  redirect(`/dashboard/students/${student.id}`);
}

export async function addGuardianAction(formData: FormData) {
  const ctx = await requireCan("students");
  const studentId = String(formData.get("studentId") ?? "");
  const student = await db.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.schoolId, ctx.schoolId)),
  });
  if (!student) throw new Error("Unknown student.");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name || !phone) throw new Error("Guardian name and phone are required.");

  const makePrimary = formData.get("isPrimaryContact") === "on";
  if (makePrimary) {
    await db.update(guardians).set({ isPrimaryContact: false }).where(eq(guardians.studentId, studentId));
  }

  await db.insert(guardians).values({
    studentId,
    relation: String(formData.get("relation") ?? "OTHER") as "OTHER",
    name,
    phone,
    altPhone: String(formData.get("altPhone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    occupation: String(formData.get("occupation") ?? "").trim() || null,
    workplace: String(formData.get("workplace") ?? "").trim() || null,
    nationalId: String(formData.get("nationalId") ?? "").replace(/[^\d]/g, "") || null,
    isPrimaryContact: makePrimary,
    isEmergencyContact: formData.get("isEmergencyContact") === "on",
  });

  revalidatePath(`/dashboard/students/${studentId}`);
}

export async function updateStudentStatusAction(formData: FormData) {
  const ctx = await requireCan("students");
  const studentId = String(formData.get("studentId") ?? "");
  const status = String(formData.get("status") ?? "");
  const valid = ["APPLICANT", "ENROLLED", "GRADUATED", "WITHDRAWN", "TRANSFERRED"];
  if (!valid.includes(status)) throw new Error("Invalid status.");

  await db
    .update(students)
    .set({ status: status as "ENROLLED", updatedAt: new Date() })
    .where(and(eq(students.id, studentId), eq(students.schoolId, ctx.schoolId)));

  revalidatePath(`/dashboard/students/${studentId}`);
  revalidatePath("/dashboard/students");
}

export async function addDiscountAction(formData: FormData) {
  const ctx = await requireCan("fees");
  const studentId = String(formData.get("studentId") ?? "");
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const kind = String(formData.get("kind") ?? "OTHER");
  const basis = String(formData.get("basis") ?? "PERCENT");
  const value = Number(formData.get("value") ?? 0);
  const appliesToCategory = String(formData.get("appliesToCategory") ?? "");

  if (!Number.isFinite(value) || value <= 0) throw new Error("Enter a discount value above zero.");
  if (basis === "PERCENT" && value > 100) throw new Error("A percentage discount can't exceed 100%.");

  await db.insert(discounts).values({
    schoolId: ctx.schoolId,
    studentId,
    academicYearId,
    kind: kind as "OTHER",
    basis: basis as "PERCENT" | "AMOUNT",
    value: value.toFixed(2),
    appliesToCategory: appliesToCategory ? (appliesToCategory as "TUITION") : null,
    note: String(formData.get("note") ?? "").trim() || null,
    approvedByStaffId: ctx.staffId,
  });

  revalidatePath(`/dashboard/students/${studentId}`);
}
