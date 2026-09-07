import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  enrollments,
  guardians,
  paymentAllocations,
  students,
  studentFees,
} from "@/db/schema";
import { fromPiastres, toPiastres } from "@/lib/money";

export function fullName(s: {
  firstName: string;
  secondName?: string | null;
  thirdName?: string | null;
  familyName: string;
}): string {
  return [s.firstName, s.secondName, s.thirdName, s.familyName].filter(Boolean).join(" ");
}

export type StudentListRow = {
  id: string;
  code: string;
  name: string;
  latinName: string | null;
  nationalId: string | null;
  status: string;
  gradeName: string | null;
  gradeNameAr: string | null;
  classroomName: string | null;
  primaryGuardian: string | null;
  primaryPhone: string | null;
  balance: string;
};

// The register: one row per student, with their current-year placement,
// primary guardian, and outstanding balance for that year.
export async function listStudents(
  schoolId: string,
  academicYearId: string | null,
  opts: { search?: string; gradeLevelId?: string; status?: string } = {},
): Promise<StudentListRow[]> {
  const filters = [eq(students.schoolId, schoolId)];
  if (opts.search) {
    const q = `%${opts.search.trim()}%`;
    filters.push(
      or(
        ilike(students.firstName, q),
        ilike(students.familyName, q),
        ilike(students.latinName, q),
        ilike(students.code, q),
        ilike(students.nationalId, q),
      )!,
    );
  }
  if (opts.status) filters.push(eq(students.status, opts.status as typeof students.$inferSelect.status));

  const rows = await db.query.students.findMany({
    where: and(...filters),
    orderBy: [asc(students.familyName), asc(students.firstName)],
    with: {
      guardians: true,
      enrollments: academicYearId
        ? {
            where: eq(enrollments.academicYearId, academicYearId),
            with: { gradeLevel: true, classroom: true },
          }
        : { with: { gradeLevel: true, classroom: true }, orderBy: desc(enrollments.createdAt), limit: 1 },
    },
  });

  // Outstanding per student for the year: billed net minus everything allocated
  // to that student's fees. Two grouped queries, merged in memory.
  const balanceByStudent = new Map<string, string>();
  if (academicYearId) {
    const netRows = await db
      .select({
        studentId: studentFees.studentId,
        net: sql<string>`coalesce(sum(${studentFees.netAmount}), 0)`,
      })
      .from(studentFees)
      .where(eq(studentFees.academicYearId, academicYearId))
      .groupBy(studentFees.studentId);

    const paidRows = await db
      .select({
        studentId: studentFees.studentId,
        paid: sql<string>`coalesce(sum(${paymentAllocations.amount}), 0)`,
      })
      .from(paymentAllocations)
      .innerJoin(studentFees, eq(paymentAllocations.studentFeeId, studentFees.id))
      .where(eq(studentFees.academicYearId, academicYearId))
      .groupBy(studentFees.studentId);
    const paidByStudent = new Map(paidRows.map((r) => [r.studentId, toPiastres(r.paid)]));

    for (const r of netRows) {
      const remaining = toPiastres(r.net) - (paidByStudent.get(r.studentId) ?? 0);
      balanceByStudent.set(r.studentId, fromPiastres(Math.max(0, remaining)));
    }
  }

  let filtered = rows;
  if (opts.gradeLevelId) {
    filtered = rows.filter((r) => r.enrollments.some((e) => e.gradeLevelId === opts.gradeLevelId));
  }

  return filtered.map((s) => {
    const enr = s.enrollments[0];
    const primary =
      s.guardians.find((g) => g.isPrimaryContact) ?? s.guardians[0] ?? null;
    return {
      id: s.id,
      code: s.code,
      name: fullName(s),
      latinName: s.latinName,
      nationalId: s.nationalId,
      status: s.status,
      gradeName: enr?.gradeLevel?.name ?? null,
      gradeNameAr: enr?.gradeLevel?.nameAr ?? null,
      classroomName: enr?.classroom?.name ?? null,
      primaryGuardian: primary?.name ?? null,
      primaryPhone: primary?.phone ?? null,
      balance: balanceByStudent.get(s.id) ?? "0.00",
    };
  });
}

export async function getStudent(schoolId: string, studentId: string) {
  return db.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
    with: {
      guardians: { orderBy: [desc(guardians.isPrimaryContact), asc(guardians.name)] },
      documents: true,
      enrollments: {
        with: { academicYear: true, gradeLevel: true, classroom: true },
        orderBy: desc(enrollments.createdAt),
      },
      discounts: { with: { academicYear: true } },
    },
  });
}

export async function nextStudentCode(schoolId: string, shortName: string | null, startYear: number): Promise<string> {
  const prefix = `${(shortName ?? "STU").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "STU"}-${startYear}-`;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), ilike(students.code, `${prefix}%`)));
  return `${prefix}${String(Number(row?.count ?? 0) + 1).padStart(4, "0")}`;
}
