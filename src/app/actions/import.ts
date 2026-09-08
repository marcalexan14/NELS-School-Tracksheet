"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classrooms, enrollments, gradeLevels, guardians, students } from "@/db/schema";
import { requireCan } from "@/lib/session";
import { getCurrentYear } from "@/lib/academic";
import { nextStudentCode } from "@/lib/students";
import {
  parseWorkbook,
  normalizeRow,
  type RowResult,
  type NormalizedStudent,
  type GradeRef,
  type ClassroomRef,
} from "@/lib/student-import";

async function loadRefs(schoolId: string, academicYearId: string | undefined) {
  const grades: GradeRef[] = (
    await db.query.gradeLevels.findMany({
      where: eq(gradeLevels.schoolId, schoolId),
      columns: { id: true, name: true, nameAr: true },
    })
  ).map((g) => ({ id: g.id, name: g.name, nameAr: g.nameAr }));

  const cls: ClassroomRef[] = academicYearId
    ? (
        await db.query.classrooms.findMany({
          where: eq(classrooms.academicYearId, academicYearId),
          columns: { id: true, name: true, gradeLevelId: true },
        })
      ).map((c) => ({ id: c.id, name: c.name, gradeLevelId: c.gradeLevelId }))
    : [];

  return { grades, cls };
}

export type PreviewState = {
  step: "idle" | "preview" | "error";
  message?: string;
  rows: RowResult[];
  validCount: number;
  errorCount: number;
};

const emptyPreview: PreviewState = { step: "idle", rows: [], validCount: 0, errorCount: 0 };

export async function previewStudentImport(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  const ctx = await requireCan("students");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...emptyPreview, step: "error", message: "Choose an .xlsx or .csv file." };
  }
  if (file.size > 6 * 1024 * 1024) {
    return { ...emptyPreview, step: "error", message: "File is larger than 6 MB." };
  }

  const year = await getCurrentYear(ctx.schoolId);
  const { grades, cls } = await loadRefs(ctx.schoolId, year?.id);

  let raw;
  try {
    raw = parseWorkbook(await file.arrayBuffer());
  } catch {
    return { ...emptyPreview, step: "error", message: "Couldn't read that file. Save it as .xlsx and try again." };
  }
  if (raw.length === 0) {
    return { ...emptyPreview, step: "error", message: "No data rows found. Use the template and keep the header row." };
  }
  if (raw.length > 2000) {
    return { ...emptyPreview, step: "error", message: "Import at most 2000 rows at a time." };
  }

  const rows = raw.map((r, i) => normalizeRow(r, i + 2, grades, cls));
  const validCount = rows.filter((r) => r.data).length;

  return {
    step: "preview",
    rows,
    validCount,
    errorCount: rows.length - validCount,
    message: year ? undefined : "No current academic year — students will be imported as applicants, not enrolled.",
  };
}

export type CommitState = { done: boolean; created: number; enrolled: number; skipped: number; message?: string };

export async function commitStudentImport(
  _prev: CommitState,
  formData: FormData,
): Promise<CommitState> {
  const ctx = await requireCan("students");
  const payload = String(formData.get("payload") ?? "");

  let items: NormalizedStudent[];
  try {
    items = JSON.parse(payload);
  } catch {
    return { done: true, created: 0, enrolled: 0, skipped: 0, message: "Import data was lost — re-upload the file." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { done: true, created: 0, enrolled: 0, skipped: 0, message: "Nothing to import." };
  }

  const year = await getCurrentYear(ctx.schoolId);
  const validGradeIds = new Set(
    (await db.query.gradeLevels.findMany({ where: eq(gradeLevels.schoolId, ctx.schoolId), columns: { id: true } })).map((g) => g.id),
  );

  // De-dupe against students already on file by national ID.
  const incomingNids = items.map((i) => i.nationalId).filter(Boolean) as string[];
  const existingNids = new Set(
    incomingNids.length
      ? (
          await db.query.students.findMany({
            where: and(eq(students.schoolId, ctx.schoolId), inArray(students.nationalId, incomingNids)),
            columns: { nationalId: true },
          })
        ).map((s) => s.nationalId)
      : [],
  );

  const startYear = year ? Number(year.name.slice(0, 4)) : new Date().getFullYear();
  let created = 0;
  let enrolled = 0;
  let skipped = 0;

  for (const item of items) {
    if (item.nationalId && existingNids.has(item.nationalId)) {
      skipped += 1;
      continue;
    }
    if (!item.firstName || !item.familyName || !item.gender || !item.dateOfBirth || !item.guardianName || !item.guardianPhone) {
      skipped += 1;
      continue;
    }

    const gradeLevelId = item.gradeLevelId && validGradeIds.has(item.gradeLevelId) ? item.gradeLevelId : null;
    const willEnrol = Boolean(gradeLevelId && year);
    const code = await nextStudentCode(ctx.schoolId, ctx.school.shortName, startYear);

    const [student] = await db
      .insert(students)
      .values({
        schoolId: ctx.schoolId,
        code,
        nationalId: item.nationalId,
        firstName: item.firstName,
        secondName: item.secondName,
        thirdName: item.thirdName,
        familyName: item.familyName,
        latinName: item.latinName,
        gender: item.gender,
        dateOfBirth: item.dateOfBirth,
        birthGovernorate: item.birthGovernorate,
        nationality: item.nationality || "Egyptian",
        religion: item.religion,
        address: item.address,
        status: willEnrol ? "ENROLLED" : "APPLICANT",
      })
      .returning();

    await db.insert(guardians).values({
      studentId: student.id,
      relation: item.guardianRelation,
      name: item.guardianName,
      phone: item.guardianPhone,
      email: item.guardianEmail,
      occupation: item.guardianOccupation,
      isPrimaryContact: true,
      isEmergencyContact: true,
    });

    if (willEnrol) {
      await db.insert(enrollments).values({
        schoolId: ctx.schoolId,
        studentId: student.id,
        academicYearId: year!.id,
        gradeLevelId: gradeLevelId!,
        classroomId: item.classroomId,
        enrollmentDate: year!.startDate,
        status: "ACTIVE",
      });
      enrolled += 1;
    }
    if (item.nationalId) existingNids.add(item.nationalId);
    created += 1;
  }

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/enrollments");
  revalidatePath("/dashboard");

  return {
    done: true,
    created,
    enrolled,
    skipped,
    message: `Imported ${created} student${created === 1 ? "" : "s"}${enrolled ? `, ${enrolled} enrolled` : ""}${skipped ? `, ${skipped} skipped` : ""}.`,
  };
}
