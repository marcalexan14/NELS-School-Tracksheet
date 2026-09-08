import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  schools,
  staff,
  academicYears,
  gradeLevels,
  classrooms,
  feeItems,
  feePlans,
  feePlanLines,
  students,
  guardians,
  enrollments,
} from "@/db/schema";
import { provisionSchool } from "@/lib/provision";
import { generateBillsForYear } from "@/lib/fees";
import { recordPayment } from "@/lib/payments";

// Development-only: builds a fully populated demo school so every screen has
// something to show. Never enabled in production.
//
//   GET /api/dev/seed        -> seeds (idempotent-ish; refuses if data exists)
//   GET /api/dev/seed?reset  -> wipes the demo school first, then seeds

export const dynamic = "force-dynamic";

const FEMALE = [
  "مريم", "حبيبة", "ملك", "جنى", "لجين", "رقية", "سلمى", "نور", "فريدة", "تالا",
  "هنا", "كنزي", "لينا", "روان", "ياسمين", "زينة",
];
const MALE = [
  "يوسف", "عمر", "أدهم", "مازن", "كريم", "زياد", "مروان", "سيف", "حمزة", "علي",
  "خالد", "طارق", "أنس", "بلال", "رامي", "فارس",
];
const FATHERS = [
  "أحمد", "محمد", "خالد", "طارق", "شريف", "وليد", "سعيد", "هاني", "عصام", "مجدي",
  "رمزي", "فؤاد", "عماد", "ياسر", "أشرف", "جرجس", "بشارة", "مينا",
];
const FAMILIES = [
  "علي", "حسن", "منصور", "عبد الله", "إبراهيم", "السيد", "عبد الرحمن", "الشناوي",
  "زكي", "بدر", "الفقي", "سلطان", "خليل", "رزق", "جاد", "لبيب",
];
const GOVS = ["Cairo", "Giza", "Alexandria", "Qalyubia", "Sharqia", "Dakahlia"];

// Per-stage tuition (EGP) — realistic private-school range.
const TUITION_BY_STAGE: Record<string, number> = {
  KG: 32000,
  PRIMARY: 40000,
  PREPARATORY: 46000,
  SECONDARY: 55000,
};
const OTHER_FEES: Record<string, number> = {
  Registration: 3000,
  Bus: 9000,
  Books: 2500,
  Uniform: 1800,
  Activities: 2000,
  Exams: 1200,
};

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production." }, { status: 403 });
  }

  const url = new URL(req.url);
  const reset = url.searchParams.has("reset");

  let school = await db.query.schools.findFirst();

  if (school && reset) {
    await db.delete(schools).where(eq(schools.id, school.id));
    school = undefined;
  }
  if (school) {
    const existingStudents = await db.query.students.findFirst({
      where: eq(students.schoolId, school.id),
    });
    if (existingStudents) {
      return NextResponse.json(
        { error: "Demo data already present. Call /api/dev/seed?reset to rebuild." },
        { status: 409 },
      );
    }
  }

  // ---- School + owner + ladder ----
  const startYear = 2025;
  if (!school) {
    const passwordHash = await bcrypt.hash("password123", 10);
    // Reuse the demo user across ?reset runs (users aren't school-scoped).
    let owner = await db.query.users.findFirst({ where: eq(users.email, "admin@nels.test") });
    if (owner) {
      await db.update(users).set({ passwordHash }).where(eq(users.id, owner.id));
    } else {
      [owner] = await db
        .insert(users)
        .values({ name: "Hala Abdel Aziz", email: "admin@nels.test", passwordHash })
        .returning();
    }
    [school] = await db
      .insert(schools)
      .values({
        name: "New Egyptian Language School",
        shortName: "NELS",
        educationDirectorate: "إدارة مصر الجديدة التعليمية",
        address: "Ard El Golf, Heliopolis, Cairo",
        phone: "02 2417 0000",
        email: "admin@nels.test",
      })
      .returning();
    await db.insert(staff).values({
      schoolId: school.id,
      userId: owner.id,
      role: "OWNER",
      title: "Principal",
    });
    await provisionSchool(school.id, {
      name: `${startYear} / ${startYear + 1}`,
      startDate: `${startYear}-09-01`,
      endDate: `${startYear + 1}-06-30`,
    });
  }

  const year = await db.query.academicYears.findFirst({
    where: and(eq(academicYears.schoolId, school.id), eq(academicYears.isCurrent, true)),
  });
  if (!year) return NextResponse.json({ error: "No current year." }, { status: 500 });

  const grades = await db.query.gradeLevels.findMany({
    where: eq(gradeLevels.schoolId, school.id),
    with: { stage: true },
    orderBy: (g, { asc }) => asc(g.ordinal),
  });
  const items = await db.query.feeItems.findMany({ where: eq(feeItems.schoolId, school.id) });
  const itemByName = new Map(items.map((i) => [i.name, i]));

  // ---- Fee plans + classrooms per grade ----
  for (const g of grades) {
    const [plan] = await db
      .insert(feePlans)
      .values({
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: g.id,
        installmentCount: 4,
      })
      .returning();

    const tuition = TUITION_BY_STAGE[g.stage.key] ?? 40000;
    const lines: (typeof feePlanLines.$inferInsert)[] = [
      { feePlanId: plan.id, feeItemId: itemByName.get("Tuition")!.id, amount: tuition.toFixed(2), mandatory: true, splitIntoInstallments: true },
    ];
    for (const [name, amount] of Object.entries(OTHER_FEES)) {
      const item = itemByName.get(name);
      if (!item) continue;
      lines.push({
        feePlanId: plan.id,
        feeItemId: item.id,
        amount: amount.toFixed(2),
        mandatory: name !== "Bus",
        splitIntoInstallments: false,
      });
    }
    await db.insert(feePlanLines).values(lines);

    for (const section of ["A", "B"]) {
      await db.insert(classrooms).values({
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: g.id,
        name: `${g.name.replace(/[^0-9]/g, "") || g.name}-${section}`,
        capacity: 30,
      });
    }
  }

  const yearClassrooms = await db.query.classrooms.findMany({
    where: eq(classrooms.academicYearId, year.id),
  });
  const classroomsByGrade = new Map<string, typeof yearClassrooms>();
  for (const c of yearClassrooms) {
    const list = classroomsByGrade.get(c.gradeLevelId) ?? [];
    list.push(c);
    classroomsByGrade.set(c.gradeLevelId, list);
  }

  // ---- Students (about 6 per grade = ~84) ----
  let code = 1;
  const createdStudents: { id: string }[] = [];
  for (const g of grades) {
    const perGrade = randInt(5, 8);
    for (let i = 0; i < perGrade; i++) {
      const male = Math.random() < 0.5;
      const first = male ? rand(MALE) : rand(FEMALE);
      const father = rand(FATHERS);
      let grandfather = rand(FATHERS);
      while (grandfather === father) grandfather = rand(FATHERS);
      const family = rand(FAMILIES);
      const birthYear = startYear - (g.ordinal + 3);

      const [student] = await db
        .insert(students)
        .values({
          schoolId: school.id,
          code: `NELS-${startYear}-${String(code++).padStart(4, "0")}`,
          nationalId: `3${birthYear.toString().slice(2)}${String(randInt(1, 12)).padStart(2, "0")}${String(randInt(1, 28)).padStart(2, "0")}${String(randInt(10000, 99999)).padStart(5, "0")}`.slice(0, 14),
          firstName: first,
          secondName: father,
          thirdName: grandfather,
          familyName: family,
          latinName: null,
          gender: male ? "MALE" : "FEMALE",
          dateOfBirth: `${birthYear}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`,
          birthGovernorate: rand(GOVS),
          nationality: "Egyptian",
          religion: Math.random() < 0.9 ? "MUSLIM" : "CHRISTIAN",
          address: `${randInt(1, 90)} ${rand(["Nozha", "Golf", "Merryland", "Roxy", "Korba"])} St, Heliopolis`,
          status: "ENROLLED",
        })
        .returning();
      createdStudents.push(student);

      await db.insert(guardians).values({
        studentId: student.id,
        relation: "FATHER",
        name: `${father} ${grandfather} ${family}`,
        phone: `010${randInt(10000000, 99999999)}`,
        occupation: rand(["مهندس", "طبيب", "محاسب", "مدرس", "موظف", "صيدلي", "محامي"]),
        isPrimaryContact: true,
        isEmergencyContact: true,
      });

      const sections = classroomsByGrade.get(g.id) ?? [];
      await db.insert(enrollments).values({
        schoolId: school.id,
        studentId: student.id,
        academicYearId: year.id,
        gradeLevelId: g.id,
        classroomId: sections.length ? rand(sections).id : null,
        enrollmentDate: `${startYear}-09-01`,
        status: "ACTIVE",
      });
    }
  }

  // ---- Bills ----
  const bills = await generateBillsForYear(school.id, year.id, year.startDate);

  // ---- Payments: ~70% of students have paid something ----
  let payments = 0;
  for (const s of createdStudents) {
    if (Math.random() < 0.28) continue;
    const feeRows = await db.query.studentFees.findMany({
      where: (sf, { eq: e, and: a }) => a(e(sf.studentId, s.id), e(sf.academicYearId, year.id)),
    });
    const totalNet = feeRows.reduce((t, f) => t + Number(f.netAmount), 0);
    const fraction = rand([0.25, 0.5, 0.5, 0.75, 1]);
    const amount = Math.round(totalNet * fraction);
    if (amount <= 0) continue;

    const month = randInt(8, 13); // Sep..Feb-ish
    const paidOn = new Date(Date.UTC(startYear, month, randInt(1, 27))).toISOString().slice(0, 10);
    await recordPayment({
      schoolId: school.id,
      studentId: s.id,
      academicYearId: year.id,
      yearStart: startYear,
      amount: amount.toFixed(2),
      method: rand(["CASH", "INSTAPAY", "BANK_TRANSFER", "INSTAPAY", "CHEQUE"]),
      paidOn,
      receivedByStaffId: null,
    });
    payments += 1;
  }

  return NextResponse.json({
    ok: true,
    school: school.name,
    login: { email: "admin@nels.test", password: "password123" },
    students: createdStudents.length,
    bills,
    payments,
  });
}
