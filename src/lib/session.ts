import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, staff } from "@/db/schema";
import { auth } from "@/auth";

export type Role = "OWNER" | "ADMIN" | "REGISTRAR" | "ACCOUNTANT" | "TEACHER" | "VIEWER";

// Single-tenant: there is exactly one school row once setup is done.
export async function getSchool() {
  return db.query.schools.findFirst();
}

export type StaffContext = {
  userId: string;
  schoolId: string;
  staffId: string;
  role: Role;
  school: typeof schools.$inferSelect;
};

// Every dashboard page and server action funnels through this. Redirects to
// /login when signed out and to /setup when the school hasn't been created yet.
export async function requireStaff(): Promise<StaffContext> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const school = await getSchool();
  if (!school) redirect("/setup");

  const member = await db.query.staff.findFirst({
    where: eq(staff.userId, session.user.id),
    with: { school: true },
  });
  if (!member) redirect("/login");

  return {
    userId: session.user.id,
    schoolId: member.schoolId,
    staffId: member.id,
    role: member.role,
    school: member.school,
  };
}

const WRITE_ROLES: Record<string, Role[]> = {
  students: ["OWNER", "ADMIN", "REGISTRAR"],
  enrollments: ["OWNER", "ADMIN", "REGISTRAR"],
  fees: ["OWNER", "ADMIN", "ACCOUNTANT"],
  payments: ["OWNER", "ADMIN", "ACCOUNTANT"],
  settings: ["OWNER", "ADMIN"],
};

export function can(role: Role, area: keyof typeof WRITE_ROLES): boolean {
  return WRITE_ROLES[area].includes(role);
}

export async function requireCan(area: keyof typeof WRITE_ROLES): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!can(ctx.role, area)) {
    throw new Error(`Your role (${ctx.role}) can't modify ${area}.`);
  }
  return ctx;
}
