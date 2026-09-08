import * as XLSX from "xlsx";
import { and, eq, type AnyColumn } from "drizzle-orm";
import { db } from "@/db";
import {
  schools,
  staff,
  academicYears,
  gradeLevels,
  classrooms,
  students,
  enrollments,
  feeItems,
  feePlans,
  studentFees,
  discounts,
  payments,
} from "@/db/schema";
import { fromPiastres, toPiastres } from "@/lib/money";

const fullName = (s: {
  firstName: string;
  secondName: string | null;
  thirdName: string | null;
  familyName: string;
}) => [s.firstName, s.secondName, s.thirdName, s.familyName].filter(Boolean).join(" ");

// A complete, human-readable dump of the school's data as an .xlsx workbook —
// one sheet per table. IDs are kept in the last columns so a backup stays
// technically restorable. Pass `academicYearId` to scope the year-specific
// sheets (enrolments, charges, payments…) to one year.
export async function buildExportWorkbook(
  schoolId: string,
  academicYearId?: string,
): Promise<{ bytes: Uint8Array; filename: string; sheetCounts: Record<string, number> }> {
  const school = await db.query.schools.findFirst({ where: eq(schools.id, schoolId) });

  // Run sequentially — a backup isn't time-critical, and the embedded dev
  // database serves one query at a time.
  const scoped = (col: AnyColumn) =>
    academicYearId ? eq(col, academicYearId) : undefined;

  const staffRows = await db.query.staff.findMany({ where: eq(staff.schoolId, schoolId), with: { user: true } });
  const years = await db.query.academicYears.findMany({ where: eq(academicYears.schoolId, schoolId), orderBy: (y, { asc }) => asc(y.startDate) });
  const termRows = await db.query.terms.findMany({ with: { academicYear: true } });
  const grades = await db.query.gradeLevels.findMany({ where: eq(gradeLevels.schoolId, schoolId), with: { stage: true }, orderBy: (g, { asc }) => asc(g.ordinal) });
  const classRows = await db.query.classrooms.findMany({ where: eq(classrooms.schoolId, schoolId), with: { academicYear: true, gradeLevel: true, homeroomTeacher: { with: { user: true } } } });
  const studentRows = await db.query.students.findMany({ where: eq(students.schoolId, schoolId), orderBy: (s, { asc }) => [asc(s.familyName), asc(s.firstName)] });
  const guardianRows = await db.query.guardians.findMany({ with: { student: true } });
  const docRows = await db.query.studentDocuments.findMany({ with: { student: true } });
  const enrollRows = await db.query.enrollments.findMany({
    where: and(eq(enrollments.schoolId, schoolId), scoped(enrollments.academicYearId)),
    with: { student: true, academicYear: true, gradeLevel: true, classroom: true },
  });
  const feeItemRows = await db.query.feeItems.findMany({ where: eq(feeItems.schoolId, schoolId), orderBy: (f, { asc }) => asc(f.name) });
  const planRows = await db.query.feePlans.findMany({
    where: and(eq(feePlans.schoolId, schoolId), scoped(feePlans.academicYearId)),
    with: { academicYear: true, gradeLevel: true },
  });
  const planLineRows = await db.query.feePlanLines.findMany({ with: { feePlan: { with: { academicYear: true, gradeLevel: true } }, feeItem: true } });
  const chargeRows = await db.query.studentFees.findMany({
    where: and(eq(studentFees.schoolId, schoolId), scoped(studentFees.academicYearId)),
    with: { student: true, academicYear: true, feeItem: true, allocations: true },
  });
  const installmentRows = await db.query.installments.findMany({ with: { studentFee: { with: { student: true, feeItem: true } } } });
  const discountRows = await db.query.discounts.findMany({
    where: and(eq(discounts.schoolId, schoolId), scoped(discounts.academicYearId)),
    with: { student: true, academicYear: true, approvedBy: { with: { user: true } } },
  });
  const paymentRows = await db.query.payments.findMany({
    where: and(eq(payments.schoolId, schoolId), scoped(payments.academicYearId)),
    with: { student: true, academicYear: true, receivedBy: { with: { user: true } } },
    orderBy: (p, { asc }) => asc(p.paidOn),
  });
  const allocationRows = await db.query.paymentAllocations.findMany({
    with: {
      payment: { with: { student: true } },
      studentFee: { with: { feeItem: true } },
      installment: true,
    },
  });

  // Year filter for tables that don't carry schoolId directly.
  const yearName = academicYearId ? years.find((y) => y.id === academicYearId)?.name : null;
  const inYear = (id: string | null | undefined) => !academicYearId || id === academicYearId;

  const chargePaid = new Map(
    chargeRows.map((c) => [
      c.id,
      c.allocations.reduce((s, a) => s + toPiastres(a.amount), 0),
    ]),
  );

  const wb = XLSX.utils.book_new();
  const counts: Record<string, number> = {};

  const add = (name: string, rows: Record<string, unknown>[]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    // Column widths from header length.
    if (rows[0]) {
      ws["!cols"] = Object.keys(rows[0]).map((k) => ({ wch: Math.min(40, Math.max(12, k.length + 2)) }));
    }
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    counts[name] = rows.length;
  };

  add("School", school ? [{
    name: school.name,
    short_name: school.shortName ?? "",
    education_directorate: school.educationDirectorate ?? "",
    address: school.address ?? "",
    phone: school.phone ?? "",
    email: school.email ?? "",
    locale: school.locale,
    currency: school.baseCurrency,
    accent_color: school.accentColor,
    id: school.id,
  }] : []);

  add("Academic years", years.map((y) => ({
    name: y.name, start_date: y.startDate, end_date: y.endDate, is_current: y.isCurrent, id: y.id,
  })));

  add("Terms", termRows
    .filter((tm) => inYear(tm.academicYearId))
    .map((tm) => ({
      academic_year: tm.academicYear.name, name: tm.name, ordinal: tm.ordinal,
      start_date: tm.startDate, end_date: tm.endDate, id: tm.id, academic_year_id: tm.academicYearId,
    })));

  add("Grade ladder", grades.map((g) => ({
    stage: g.stage.name, stage_ar: g.stage.nameAr, grade: g.name, grade_ar: g.nameAr,
    ordinal: g.ordinal, id: g.id, stage_id: g.stageId,
  })));

  add("Classrooms", classRows
    .filter((c) => inYear(c.academicYearId))
    .map((c) => ({
      academic_year: c.academicYear.name, grade: c.gradeLevel.name, name: c.name, capacity: c.capacity,
      homeroom_teacher: c.homeroomTeacher?.user?.name ?? "",
      id: c.id, academic_year_id: c.academicYearId, grade_level_id: c.gradeLevelId,
    })));

  add("Staff", staffRows.map((m) => ({
    name: m.user.name ?? "", email: m.user.email, role: m.role, title: m.title ?? "",
    id: m.id, user_id: m.userId,
  })));

  add("Students", studentRows.map((s) => ({
    code: s.code,
    national_id: s.nationalId ?? "",
    first_name: s.firstName,
    father_name: s.secondName ?? "",
    grandfather_name: s.thirdName ?? "",
    family_name: s.familyName,
    name_en: s.latinName ?? "",
    gender: s.gender,
    date_of_birth: s.dateOfBirth,
    birth_governorate: s.birthGovernorate ?? "",
    nationality: s.nationality,
    religion: s.religion ?? "",
    address: s.address ?? "",
    status: s.status,
    notes: s.notes ?? "",
    created_at: s.createdAt.toISOString(),
    id: s.id,
  })));

  add("Guardians", guardianRows.map((g) => ({
    student_code: g.student.code, student_name: fullName(g.student),
    relation: g.relation, name: g.name, national_id: g.nationalId ?? "",
    phone: g.phone, alt_phone: g.altPhone ?? "", email: g.email ?? "",
    occupation: g.occupation ?? "", workplace: g.workplace ?? "",
    is_primary_contact: g.isPrimaryContact, is_emergency_contact: g.isEmergencyContact,
    id: g.id, student_id: g.studentId,
  })));

  add("Enrolments", enrollRows.map((e) => ({
    student_code: e.student.code, student_name: fullName(e.student),
    academic_year: e.academicYear.name, grade: e.gradeLevel.name, classroom: e.classroom?.name ?? "",
    enrolment_date: e.enrollmentDate, previous_school: e.previousSchool ?? "", status: e.status,
    id: e.id, student_id: e.studentId, academic_year_id: e.academicYearId, grade_level_id: e.gradeLevelId,
  })));

  add("Documents", docRows.map((d) => ({
    student_code: d.student.code, student_name: fullName(d.student),
    kind: d.kind, file_name: d.fileName, file_url: d.fileUrl, note: d.note ?? "",
    uploaded_at: d.uploadedAt.toISOString(), id: d.id, student_id: d.studentId,
  })));

  add("Fee items", feeItemRows.map((f) => ({
    name: f.name, name_ar: f.nameAr ?? "", category: f.category, active: f.active, id: f.id,
  })));

  add("Fee plans", planRows.map((p) => ({
    academic_year: p.academicYear.name, grade: p.gradeLevel.name,
    installment_count: p.installmentCount, notes: p.notes ?? "", id: p.id,
  })));

  add("Fee plan lines", planLineRows
    .filter((l) => inYear(l.feePlan.academicYearId))
    .map((l) => ({
      academic_year: l.feePlan.academicYear.name, grade: l.feePlan.gradeLevel.name,
      fee_item: l.feeItem.name, amount: Number(l.amount), mandatory: l.mandatory,
      split_into_installments: l.splitIntoInstallments, id: l.id,
    })));

  add("Charges", chargeRows.map((c) => {
    const net = toPiastres(c.netAmount);
    const paid = chargePaid.get(c.id) ?? 0;
    return {
      student_code: c.student.code, student_name: fullName(c.student),
      academic_year: c.academicYear.name, fee_item: c.feeItem.name,
      gross: Number(c.grossAmount), discount: Number(c.discountAmount),
      discount_reason: c.discountReason ?? "", net: Number(c.netAmount),
      paid: Number(fromPiastres(paid)), remaining: Number(fromPiastres(Math.max(0, net - paid))),
      due_date: c.dueDate, status: c.status,
      id: c.id, student_id: c.studentId, academic_year_id: c.academicYearId,
    };
  }));

  add("Installments", installmentRows
    .filter((i) => inYear(i.studentFee.academicYearId))
    .map((i) => ({
      student_code: i.studentFee.student.code, student_name: fullName(i.studentFee.student),
      fee_item: i.studentFee.feeItem.name, sequence: i.sequence, due_date: i.dueDate,
      amount: Number(i.amount), paid_amount: Number(i.paidAmount), status: i.status,
      id: i.id, student_fee_id: i.studentFeeId,
    })));

  add("Discounts", discountRows.map((d) => ({
    student_code: d.student.code, student_name: fullName(d.student),
    academic_year: d.academicYear.name, kind: d.kind, basis: d.basis, value: Number(d.value),
    applies_to_category: d.appliesToCategory ?? "", note: d.note ?? "",
    approved_by: d.approvedBy?.user?.name ?? "", id: d.id,
  })));

  add("Payments", paymentRows.map((p) => ({
    receipt_number: p.receiptNumber, date: p.paidOn,
    student_code: p.student.code, student_name: fullName(p.student),
    academic_year: p.academicYear.name, method: p.method, amount: Number(p.amount),
    reference: p.reference ?? "", note: p.note ?? "",
    received_by: p.receivedBy?.user?.name ?? "",
    id: p.id, student_id: p.studentId,
  })));

  add("Payment allocations", allocationRows
    .filter((a) => !academicYearId || a.payment.academicYearId === academicYearId)
    .map((a) => ({
      receipt_number: a.payment.receiptNumber, student_name: fullName(a.payment.student),
      fee_item: a.studentFee.feeItem.name, installment_sequence: a.installment?.sequence ?? "",
      amount: Number(a.amount), id: a.id, payment_id: a.paymentId, student_fee_id: a.studentFeeId,
    })));

  add("_Backup info", [
    { key: "exported_at", value: new Date().toISOString() },
    { key: "school", value: school?.name ?? "" },
    { key: "scope", value: yearName ? `Academic year ${yearName}` : "All data" },
    { key: "app", value: "NELS Tracking Sheet" },
    ...Object.entries(counts).map(([k, v]) => ({ key: `rows: ${k}`, value: v })),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `nels-backup-${yearName ? yearName.replace(/\s*\/\s*/g, "-") + "-" : ""}${stamp}.xlsx`;

  return {
    bytes: XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array,
    filename,
    sheetCounts: counts,
  };
}
