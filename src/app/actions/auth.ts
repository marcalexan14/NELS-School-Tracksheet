"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, schools, staff } from "@/db/schema";
import { signIn } from "@/auth";
import { provisionSchool } from "@/lib/provision";

// First-run onboarding: creates the one school row, its owner, the Egyptian
// grade ladder, a starting academic year, and default fee items. Refuses to
// run a second time.
export async function setupAction(formData: FormData) {
  const existing = await db.query.schools.findFirst();
  if (existing) redirect("/login");

  const schoolName = String(formData.get("schoolName") ?? "").trim();
  const shortName = String(formData.get("shortName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const startYear = Number(formData.get("startYear") ?? new Date().getFullYear());

  if (!schoolName || !name || !email || !password) {
    throw new Error("School name, your name, email, and password are all required.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({ name, email, passwordHash }).returning();

  const [school] = await db
    .insert(schools)
    .values({
      name: schoolName,
      shortName: shortName || null,
      email,
    })
    .returning();

  await db.insert(staff).values({
    schoolId: school.id,
    userId: user.id,
    role: "OWNER",
    title: "Principal",
  });

  await provisionSchool(school.id, Number.isFinite(startYear) ? startYear : new Date().getFullYear());

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}
