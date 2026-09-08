"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, schools, staff, terms, users } from "@/db/schema";
import { requireCan } from "@/lib/session";

export async function updateSchoolAction(formData: FormData) {
  const ctx = await requireCan("settings");
  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("shortName") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en");
  const accentColor = String(formData.get("accentColor") ?? "#147c70").trim();
  const educationDirectorate = String(formData.get("educationDirectorate") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!name) throw new Error("School name is required.");

  await db
    .update(schools)
    .set({
      name,
      shortName: shortName || null,
      locale: locale === "ar" ? "ar" : "en",
      accentColor: /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : "#147c70",
      educationDirectorate: educationDirectorate || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      updatedAt: new Date(),
    })
    .where(eq(schools.id, ctx.schoolId));

  revalidatePath("/dashboard", "layout");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Splits [start, end] into `count` consecutive term ranges.
function splitTerms(start: string, end: string, count: number) {
  const s = Date.parse(start);
  const e = Date.parse(end);
  const step = (e - s) / count;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return Array.from({ length: count }, (_, i) => ({
    name: `Term ${i + 1}`,
    ordinal: i + 1,
    startDate: i === 0 ? start : iso(s + step * i + 86_400_000),
    endDate: i === count - 1 ? end : iso(s + step * (i + 1)),
  }));
}

export async function addAcademicYearAction(formData: FormData) {
  const ctx = await requireCan("settings");

  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const termCount = Math.max(1, Math.min(4, Number(formData.get("termCount") ?? 2)));
  const makeCurrent = formData.get("makeCurrent") === "on";

  if (!name) throw new Error("Give the year a name (e.g. \"2025 / 2026\").");
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) throw new Error("Pick a start and end date.");
  if (Date.parse(endDate) <= Date.parse(startDate)) throw new Error("The end date must be after the start date.");

  const existing = await db.query.academicYears.findFirst({
    where: and(eq(academicYears.schoolId, ctx.schoolId), eq(academicYears.name, name)),
  });
  if (existing) throw new Error(`"${name}" already exists.`);

  const [year] = await db
    .insert(academicYears)
    .values({ schoolId: ctx.schoolId, name, startDate, endDate, isCurrent: makeCurrent })
    .returning();

  await db.insert(terms).values(
    splitTerms(startDate, endDate, termCount).map((t) => ({ academicYearId: year.id, ...t })),
  );

  if (makeCurrent) {
    await db
      .update(academicYears)
      .set({ isCurrent: false })
      .where(and(eq(academicYears.schoolId, ctx.schoolId), ne(academicYears.id, year.id)));
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
}

// Edit a year's name / dates. Optionally re-split its terms to the new range.
export async function updateAcademicYearAction(formData: FormData) {
  const ctx = await requireCan("settings");
  const yearId = String(formData.get("yearId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const resetTerms = formData.get("resetTerms") === "on";

  const year = await db.query.academicYears.findFirst({
    where: and(eq(academicYears.id, yearId), eq(academicYears.schoolId, ctx.schoolId)),
  });
  if (!year) throw new Error("Unknown academic year.");
  if (!name) throw new Error("The year needs a name.");
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) throw new Error("Pick a start and end date.");
  if (Date.parse(endDate) <= Date.parse(startDate)) throw new Error("The end date must be after the start date.");

  const clash = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.schoolId, ctx.schoolId),
      eq(academicYears.name, name),
      ne(academicYears.id, yearId),
    ),
  });
  if (clash) throw new Error(`Another year is already called "${name}".`);

  await db.update(academicYears).set({ name, startDate, endDate }).where(eq(academicYears.id, yearId));

  if (resetTerms) {
    const existing = await db.query.terms.findMany({ where: eq(terms.academicYearId, yearId) });
    await db.delete(terms).where(eq(terms.academicYearId, yearId));
    await db.insert(terms).values(
      splitTerms(startDate, endDate, Math.max(1, existing.length || 2)).map((t) => ({
        academicYearId: yearId,
        ...t,
      })),
    );
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
}

// Rename / re-date the terms of one year from `name_<i>`, `start_<i>`, `end_<i>`.
export async function updateTermsAction(formData: FormData) {
  const ctx = await requireCan("settings");
  const yearId = String(formData.get("yearId") ?? "");

  const year = await db.query.academicYears.findFirst({
    where: and(eq(academicYears.id, yearId), eq(academicYears.schoolId, ctx.schoolId)),
    with: { terms: { orderBy: (tm, { asc }) => asc(tm.ordinal) } },
  });
  if (!year) throw new Error("Unknown academic year.");

  for (const [i, term] of year.terms.entries()) {
    const name = String(formData.get(`name_${i}`) ?? "").trim() || term.name;
    const startDate = String(formData.get(`start_${i}`) ?? "");
    const endDate = String(formData.get(`end_${i}`) ?? "");
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
      throw new Error(`Term ${i + 1} needs a start and end date.`);
    }
    if (Date.parse(endDate) <= Date.parse(startDate)) {
      throw new Error(`Term ${i + 1}'s end date must be after its start date.`);
    }
    await db.update(terms).set({ name, startDate, endDate }).where(eq(terms.id, term.id));
  }

  revalidatePath("/dashboard/settings");
}

export async function setCurrentYearAction(formData: FormData) {
  const ctx = await requireCan("settings");
  const yearId = String(formData.get("yearId") ?? "");
  const year = await db.query.academicYears.findFirst({
    where: and(eq(academicYears.id, yearId), eq(academicYears.schoolId, ctx.schoolId)),
  });
  if (!year) throw new Error("Unknown academic year.");

  await db.update(academicYears).set({ isCurrent: false }).where(eq(academicYears.schoolId, ctx.schoolId));
  await db.update(academicYears).set({ isCurrent: true }).where(eq(academicYears.id, yearId));

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
}

export async function addStaffAction(formData: FormData) {
  const ctx = await requireCan("settings");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "VIEWER");
  const title = String(formData.get("title") ?? "").trim();

  const validRoles = ["ADMIN", "REGISTRAR", "ACCOUNTANT", "TEACHER", "VIEWER"];
  if (!name || !email || password.length < 8 || !validRoles.includes(role)) {
    throw new Error("Name, email, a role, and an 8+ character password are required.");
  }

  let user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    [user] = await db.insert(users).values({ name, email, passwordHash }).returning();
  }

  const already = await db.query.staff.findFirst({
    where: and(eq(staff.schoolId, ctx.schoolId), eq(staff.userId, user.id)),
  });
  if (already) throw new Error("That person is already a staff member.");

  await db.insert(staff).values({
    schoolId: ctx.schoolId,
    userId: user.id,
    role: role as "ADMIN" | "REGISTRAR" | "ACCOUNTANT" | "TEACHER" | "VIEWER",
    title: title || null,
  });

  revalidatePath("/dashboard/settings");
}

export async function updateStaffRoleAction(formData: FormData) {
  const ctx = await requireCan("settings");
  const staffId = String(formData.get("staffId") ?? "");
  const role = String(formData.get("role") ?? "");
  const validRoles = ["ADMIN", "REGISTRAR", "ACCOUNTANT", "TEACHER", "VIEWER"];

  const member = await db.query.staff.findFirst({
    where: and(eq(staff.id, staffId), eq(staff.schoolId, ctx.schoolId)),
  });
  if (!member) throw new Error("Unknown staff member.");
  if (member.role === "OWNER") throw new Error("The owner's role can't be changed.");
  if (!validRoles.includes(role)) throw new Error("Invalid role.");

  await db.update(staff).set({ role: role as "ADMIN" }).where(eq(staff.id, staffId));
  revalidatePath("/dashboard/settings");
}
