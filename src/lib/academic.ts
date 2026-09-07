import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, terms } from "@/db/schema";

// The "working" academic year: the one flagged current, else the newest.
export async function getCurrentYear(schoolId: string) {
  const flagged = await db.query.academicYears.findFirst({
    where: and(eq(academicYears.schoolId, schoolId), eq(academicYears.isCurrent, true)),
  });
  if (flagged) return flagged;
  return db.query.academicYears.findFirst({
    where: eq(academicYears.schoolId, schoolId),
    orderBy: desc(academicYears.startDate),
  });
}

export async function listYears(schoolId: string) {
  return db.query.academicYears.findMany({
    where: eq(academicYears.schoolId, schoolId),
    orderBy: desc(academicYears.startDate),
  });
}

// Resolves the year to show a page: an explicit ?year=<id> if valid, else current.
export async function resolveYear(schoolId: string, requestedId?: string) {
  const years = await listYears(schoolId);
  const requested = requestedId ? years.find((y) => y.id === requestedId) : undefined;
  const active = requested ?? years.find((y) => y.isCurrent) ?? years[0];
  return { years, active: active ?? null };
}

export async function listTerms(academicYearId: string) {
  return db.query.terms.findMany({
    where: eq(terms.academicYearId, academicYearId),
    orderBy: asc(terms.ordinal),
  });
}

// "2025 / 2026" -> academic year label for a given start year.
export function yearLabel(startYear: number): string {
  return `${startYear} / ${startYear + 1}`;
}
