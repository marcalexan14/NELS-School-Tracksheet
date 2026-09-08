"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  academicYears,
  classrooms,
  enrollments,
  gradeLevels,
  students,
} from "@/db/schema";
import { requireCan } from "@/lib/session";

// Edit an existing placement: move the student to a different grade / class, or
// change the enrolment status (active / completed / withdrawn).
export async function updateEnrollmentAction(formData: FormData) {
  const ctx = await requireCan("enrollments");
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  const classroomId = String(formData.get("classroomId") ?? "");
  const status = String(formData.get("status") ?? "ACTIVE");
  const validStatus = ["ACTIVE", "COMPLETED", "WITHDRAWN"];

  const enr = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.id, enrollmentId), eq(enrollments.schoolId, ctx.schoolId)),
  });
  if (!enr) throw new Error("Unknown enrolment.");
  if (!validStatus.includes(status)) throw new Error("Invalid status.");

  const grade = gradeLevelId
    ? await db.query.gradeLevels.findFirst({
        where: and(eq(gradeLevels.id, gradeLevelId), eq(gradeLevels.schoolId, ctx.schoolId)),
      })
    : null;

  // A classroom only sticks if it belongs to the (possibly new) grade + this year.
  let classroomOk: string | null = null;
  if (classroomId) {
    const cls = await db.query.classrooms.findFirst({ where: eq(classrooms.id, classroomId) });
    if (
      cls &&
      cls.academicYearId === enr.academicYearId &&
      cls.gradeLevelId === (grade?.id ?? enr.gradeLevelId)
    ) {
      classroomOk = cls.id;
    }
  }

  await db
    .update(enrollments)
    .set({
      gradeLevelId: grade?.id ?? enr.gradeLevelId,
      classroomId: classroomOk,
      status: status as "ACTIVE",
    })
    .where(eq(enrollments.id, enrollmentId));

  // Keep the student record's status roughly in step.
  if (status === "WITHDRAWN") {
    await db.update(students).set({ status: "WITHDRAWN" }).where(eq(students.id, enr.studentId));
  } else if (status === "ACTIVE") {
    await db.update(students).set({ status: "ENROLLED" }).where(eq(students.id, enr.studentId));
  }

  revalidatePath("/dashboard/enrollments");
  revalidatePath("/dashboard/students");
  revalidatePath(`/dashboard/students/${enr.studentId}`);
  redirect(`/dashboard/enrollments${formData.get("year") ? `?year=${formData.get("year")}` : ""}`);
}

export async function createClassroomAction(formData: FormData) {
  const ctx = await requireCan("enrollments");
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const capacity = Math.max(1, Math.min(60, Number(formData.get("capacity") ?? 30)));
  if (!name) throw new Error("Class name is required (e.g. \"1-A\").");

  const exists = await db.query.classrooms.findFirst({
    where: and(
      eq(classrooms.academicYearId, academicYearId),
      eq(classrooms.gradeLevelId, gradeLevelId),
      eq(classrooms.name, name),
    ),
  });
  if (exists) throw new Error(`Class "${name}" already exists for that grade.`);

  await db.insert(classrooms).values({
    schoolId: ctx.schoolId,
    academicYearId,
    gradeLevelId,
    name,
    capacity,
  });
  revalidatePath("/dashboard/enrollments");
}

export async function enrollStudentAction(formData: FormData) {
  const ctx = await requireCan("enrollments");
  const studentId = String(formData.get("studentId") ?? "");
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  const classroomId = String(formData.get("classroomId") ?? "");

  const student = await db.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.schoolId, ctx.schoolId)),
  });
  if (!student) throw new Error("Unknown student.");

  const existing = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.studentId, studentId),
      eq(enrollments.academicYearId, academicYearId),
    ),
  });
  if (existing) {
    await db
      .update(enrollments)
      .set({ gradeLevelId, classroomId: classroomId || null, status: "ACTIVE" })
      .where(eq(enrollments.id, existing.id));
  } else {
    await db.insert(enrollments).values({
      schoolId: ctx.schoolId,
      studentId,
      academicYearId,
      gradeLevelId,
      classroomId: classroomId || null,
      enrollmentDate: new Date().toISOString().slice(0, 10),
      previousSchool: String(formData.get("previousSchool") ?? "").trim() || null,
      status: "ACTIVE",
    });
  }

  if (student.status === "APPLICANT") {
    await db.update(students).set({ status: "ENROLLED" }).where(eq(students.id, studentId));
  }

  revalidatePath("/dashboard/enrollments");
  revalidatePath("/dashboard/students");
  revalidatePath(`/dashboard/students/${studentId}`);
}

// Moves every ACTIVE enrolment in `fromYearId` up one grade into `toYearId`.
// Students already in the top grade (Secondary 3) are marked GRADUATED.
export async function promoteCohortAction(formData: FormData) {
  const ctx = await requireCan("enrollments");
  const fromYearId = String(formData.get("fromYearId") ?? "");
  const toYearId = String(formData.get("toYearId") ?? "");
  if (fromYearId === toYearId) throw new Error("Pick two different academic years.");

  const [fromYear, toYear] = await Promise.all([
    db.query.academicYears.findFirst({
      where: and(eq(academicYears.id, fromYearId), eq(academicYears.schoolId, ctx.schoolId)),
    }),
    db.query.academicYears.findFirst({
      where: and(eq(academicYears.id, toYearId), eq(academicYears.schoolId, ctx.schoolId)),
    }),
  ]);
  if (!fromYear || !toYear) throw new Error("Unknown academic year.");

  const ladder = await db.query.gradeLevels.findMany({
    where: eq(gradeLevels.schoolId, ctx.schoolId),
    orderBy: (g, { asc }) => asc(g.ordinal),
  });
  const nextByOrdinal = new Map<string, string>();
  for (let i = 0; i < ladder.length - 1; i++) nextByOrdinal.set(ladder[i].id, ladder[i + 1].id);
  const topGradeId = ladder[ladder.length - 1]?.id;

  const current = await db.query.enrollments.findMany({
    where: and(eq(enrollments.academicYearId, fromYearId), eq(enrollments.status, "ACTIVE")),
  });

  const alreadyNext = await db.query.enrollments.findMany({
    where: eq(enrollments.academicYearId, toYearId),
    columns: { studentId: true },
  });
  const skip = new Set(alreadyNext.map((e) => e.studentId));

  let promoted = 0;
  let graduated = 0;
  const graduatedIds: string[] = [];

  for (const enr of current) {
    if (skip.has(enr.studentId)) continue;
    const nextGrade = nextByOrdinal.get(enr.gradeLevelId);
    if (!nextGrade) {
      if (enr.gradeLevelId === topGradeId) {
        graduatedIds.push(enr.studentId);
        graduated += 1;
      }
      continue;
    }
    await db.insert(enrollments).values({
      schoolId: ctx.schoolId,
      studentId: enr.studentId,
      academicYearId: toYearId,
      gradeLevelId: nextGrade,
      enrollmentDate: toYear.startDate,
      status: "ACTIVE",
    });
    await db.update(enrollments).set({ status: "COMPLETED" }).where(eq(enrollments.id, enr.id));
    promoted += 1;
  }

  if (graduatedIds.length) {
    await db.update(students).set({ status: "GRADUATED" }).where(inArray(students.id, graduatedIds));
    await db
      .update(enrollments)
      .set({ status: "COMPLETED" })
      .where(
        and(
          eq(enrollments.academicYearId, fromYearId),
          inArray(enrollments.studentId, graduatedIds),
        ),
      );
  }

  revalidatePath("/dashboard/enrollments");
  revalidatePath("/dashboard/students");
  redirect(
    `/dashboard/enrollments?year=${toYearId}&promoted=${promoted}&graduated=${graduated}`,
  );
}
