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

type EnrollmentEdit = {
  enrollmentId: string;
  gradeLevelId?: string;
  classroomId?: string | null;
  status?: "ACTIVE" | "COMPLETED" | "WITHDRAWN";
};

// Edit one placement in place — move the student to a different grade / class,
// or change the enrolment status. Called directly from the roster editor.
export async function updateEnrollment(edit: EnrollmentEdit): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireCan("enrollments");

  const enr = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.id, edit.enrollmentId), eq(enrollments.schoolId, ctx.schoolId)),
  });
  if (!enr) return { ok: false, error: "Unknown enrolment." };

  const status = edit.status ?? enr.status;
  if (!["ACTIVE", "COMPLETED", "WITHDRAWN"].includes(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const targetGradeId =
    edit.gradeLevelId &&
    (await db.query.gradeLevels.findFirst({
      where: and(eq(gradeLevels.id, edit.gradeLevelId), eq(gradeLevels.schoolId, ctx.schoolId)),
    }))
      ? edit.gradeLevelId
      : enr.gradeLevelId;

  // A class only sticks if it's for this year and the (possibly new) grade.
  let classroomOk: string | null = null;
  if (edit.classroomId) {
    const cls = await db.query.classrooms.findFirst({ where: eq(classrooms.id, edit.classroomId) });
    if (cls && cls.academicYearId === enr.academicYearId && cls.gradeLevelId === targetGradeId) {
      classroomOk = cls.id;
    }
  }

  await db
    .update(enrollments)
    .set({
      gradeLevelId: targetGradeId,
      classroomId: edit.classroomId === undefined ? enr.classroomId : classroomOk,
      status: status as "ACTIVE",
    })
    .where(eq(enrollments.id, edit.enrollmentId));

  if (status === "WITHDRAWN") {
    await db.update(students).set({ status: "WITHDRAWN" }).where(eq(students.id, enr.studentId));
  } else if (status === "ACTIVE" && enr.status !== "ACTIVE") {
    await db.update(students).set({ status: "ENROLLED" }).where(eq(students.id, enr.studentId));
  }

  revalidatePath("/dashboard/enrollments");
  revalidatePath("/dashboard/students");
  revalidatePath(`/dashboard/students/${enr.studentId}`);
  return { ok: true };
}

// Move several students at once into one class (and its grade).
export async function bulkMoveEnrollments(input: {
  enrollmentIds: string[];
  classroomId: string;
}): Promise<{ ok: boolean; moved: number; error?: string }> {
  const ctx = await requireCan("enrollments");
  if (!input.enrollmentIds?.length) return { ok: false, moved: 0, error: "Nothing selected." };

  const cls = await db.query.classrooms.findFirst({
    where: and(eq(classrooms.id, input.classroomId), eq(classrooms.schoolId, ctx.schoolId)),
  });
  if (!cls) return { ok: false, moved: 0, error: "Unknown class." };

  const rows = await db.query.enrollments.findMany({
    where: and(
      inArray(enrollments.id, input.enrollmentIds),
      eq(enrollments.schoolId, ctx.schoolId),
      eq(enrollments.academicYearId, cls.academicYearId),
    ),
    columns: { id: true },
  });
  if (!rows.length) return { ok: false, moved: 0, error: "Those enrolments aren't in this year." };

  await db
    .update(enrollments)
    .set({ gradeLevelId: cls.gradeLevelId, classroomId: cls.id })
    .where(inArray(enrollments.id, rows.map((r) => r.id)));

  revalidatePath("/dashboard/enrollments");
  revalidatePath("/dashboard/students");
  return { ok: true, moved: rows.length };
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
