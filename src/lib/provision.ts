import { db } from "@/db";
import { stages, gradeLevels, academicYears, terms, feeItems } from "@/db/schema";

// The Egyptian national ladder (نظام التعليم المصري), KG1 through Thanaweya Amma.
// `ordinal` is the global position 1..14 used for cohort promotion.
const LADDER: {
  key: "KG" | "PRIMARY" | "PREPARATORY" | "SECONDARY";
  name: string;
  nameAr: string;
  grades: { name: string; nameAr: string }[];
}[] = [
  {
    key: "KG",
    name: "Kindergarten",
    nameAr: "رياض الأطفال",
    grades: [
      { name: "KG1", nameAr: "كي جي 1" },
      { name: "KG2", nameAr: "كي جي 2" },
    ],
  },
  {
    key: "PRIMARY",
    name: "Primary",
    nameAr: "المرحلة الابتدائية",
    grades: [
      { name: "Primary 1", nameAr: "الصف الأول الابتدائي" },
      { name: "Primary 2", nameAr: "الصف الثاني الابتدائي" },
      { name: "Primary 3", nameAr: "الصف الثالث الابتدائي" },
      { name: "Primary 4", nameAr: "الصف الرابع الابتدائي" },
      { name: "Primary 5", nameAr: "الصف الخامس الابتدائي" },
      { name: "Primary 6", nameAr: "الصف السادس الابتدائي" },
    ],
  },
  {
    key: "PREPARATORY",
    name: "Preparatory",
    nameAr: "المرحلة الإعدادية",
    grades: [
      { name: "Prep 1", nameAr: "الصف الأول الإعدادي" },
      { name: "Prep 2", nameAr: "الصف الثاني الإعدادي" },
      { name: "Prep 3", nameAr: "الصف الثالث الإعدادي" },
    ],
  },
  {
    key: "SECONDARY",
    name: "Secondary",
    nameAr: "المرحلة الثانوية",
    grades: [
      { name: "Secondary 1", nameAr: "الصف الأول الثانوي" },
      { name: "Secondary 2", nameAr: "الصف الثاني الثانوي" },
      { name: "Secondary 3", nameAr: "الصف الثالث الثانوي" },
    ],
  },
];

const DEFAULT_FEE_ITEMS: {
  name: string;
  nameAr: string;
  category:
    | "TUITION"
    | "REGISTRATION"
    | "TRANSPORT"
    | "BOOKS"
    | "UNIFORM"
    | "ACTIVITIES"
    | "EXAMS"
    | "MEALS"
    | "OTHER";
}[] = [
  { name: "Tuition", nameAr: "المصروفات الدراسية", category: "TUITION" },
  { name: "Registration", nameAr: "رسوم القيد", category: "REGISTRATION" },
  { name: "Bus", nameAr: "اشتراك الباص", category: "TRANSPORT" },
  { name: "Books", nameAr: "الكتب", category: "BOOKS" },
  { name: "Uniform", nameAr: "الزي المدرسي", category: "UNIFORM" },
  { name: "Activities", nameAr: "الأنشطة", category: "ACTIVITIES" },
  { name: "Exams", nameAr: "رسوم الامتحانات", category: "EXAMS" },
];

// Creates the ladder, a starting academic year with two terms, and default fee
// items for a freshly created school. Safe to call once, right after insert.
//
// `year` sets the first academic year — a name ("2025 / 2026") and its exact
// start / end dates. Terms split the range in two.
export async function provisionSchool(
  schoolId: string,
  year: { name: string; startDate: string; endDate: string },
) {
  let ordinal = 0;
  for (const [stageIndex, stage] of LADDER.entries()) {
    const [stageRow] = await db
      .insert(stages)
      .values({
        schoolId,
        key: stage.key,
        name: stage.name,
        nameAr: stage.nameAr,
        ordinal: stageIndex + 1,
      })
      .returning();

    for (const grade of stage.grades) {
      ordinal += 1;
      await db.insert(gradeLevels).values({
        schoolId,
        stageId: stageRow.id,
        name: grade.name,
        nameAr: grade.nameAr,
        ordinal,
      });
    }
  }

  const [row] = await db
    .insert(academicYears)
    .values({
      schoolId,
      name: year.name,
      startDate: year.startDate,
      endDate: year.endDate,
      isCurrent: true,
    })
    .returning();

  // Two terms, split evenly across the year's range.
  const s = Date.parse(year.startDate);
  const e = Date.parse(year.endDate);
  const mid = new Date(s + (e - s) / 2).toISOString().slice(0, 10);
  const midNext = new Date(s + (e - s) / 2 + 86_400_000).toISOString().slice(0, 10);
  await db.insert(terms).values([
    { academicYearId: row.id, name: "Term 1", ordinal: 1, startDate: year.startDate, endDate: mid },
    { academicYearId: row.id, name: "Term 2", ordinal: 2, startDate: midNext, endDate: year.endDate },
  ]);

  await db.insert(feeItems).values(
    DEFAULT_FEE_ITEMS.map((f) => ({
      schoolId,
      name: f.name,
      nameAr: f.nameAr,
      category: f.category,
    })),
  );

  return { yearId: row.id };
}

export { LADDER, DEFAULT_FEE_ITEMS };
