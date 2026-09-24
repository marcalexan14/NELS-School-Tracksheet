import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, staff } from "@/db/schema";
import { auth } from "@/auth";
import { canView, can, homeFor, type Page, type Role, type WriteArea } from "@/lib/permissions";

export type { Role, Page, WriteArea };
export { can, canView, homeFor };

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

// Gate for an entire page: a role that can't see it is sent to wherever it
// does belong, quietly, rather than shown a "not allowed" wall — someone
// pasting a link from a colleague just lands on their own home screen.
export async function requireView(page: Page): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!canView(ctx.role, page)) redirect(homeFor(ctx.role));
  return ctx;
}

export async function requireCan(area: WriteArea): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!can(ctx.role, area)) {
    throw new Error(`Your role (${ctx.role}) can't modify ${area}.`);
  }
  return ctx;
}
