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

export async function addAcademicYearAction(formData: FormData) {
  const ctx = await requireCan("settings");
  const startYear = Number(formData.get("startYear"));
  if (!Number.isFinite(startYear) || startYear < 2000 || startYear > 2100) {
    throw new Error("Enter a valid start year.");
  }
  const makeCurrent = formData.get("makeCurrent") === "on";

  const name = `${startYear} / ${startYear + 1}`;
  const existing = await db.query.academicYears.findFirst({
    where: and(eq(academicYears.schoolId, ctx.schoolId), eq(academicYears.name, name)),
  });
  if (existing) throw new Error(`${name} already exists.`);

  const [year] = await db
    .insert(academicYears)
    .values({
      schoolId: ctx.schoolId,
      name,
      startDate: `${startYear}-09-01`,
      endDate: `${startYear + 1}-06-30`,
      isCurrent: makeCurrent,
    })
    .returning();

  await db.insert(terms).values([
    { academicYearId: year.id, name: "Term 1", ordinal: 1, startDate: `${startYear}-09-01`, endDate: `${startYear + 1}-01-31` },
    { academicYearId: year.id, name: "Term 2", ordinal: 2, startDate: `${startYear + 1}-02-01`, endDate: `${startYear + 1}-06-30` },
  ]);

  if (makeCurrent) {
    await db
      .update(academicYears)
      .set({ isCurrent: false })
      .where(and(eq(academicYears.schoolId, ctx.schoolId), ne(academicYears.id, year.id)));
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
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
