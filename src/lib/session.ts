import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, staff } from "@/db/schema";
import { auth } from "@/auth";
import { canView, can, homeFor, type Page, type Role, type WriteArea } from "@/lib/permissions";

export type { Role, Page, WriteArea };
export { can, canView, homeFor };

export const PREVIEW_COOKIE = "nels_preview_role";
const PREVIEWABLE_ROLES: Role[] = ["REGISTRAR", "ACCOUNTANT", "TEACHER", "VIEWER"];

// Single-tenant: there is exactly one school row once setup is done.
export async function getSchool() {
  return db.query.schools.findFirst();
}

export type StaffContext = {
  userId: string;
  schoolId: string;
  staffId: string;
  role: Role;
  // The account's actual role — unlike `role`, never swapped out by preview
  // mode. Used to decide who's allowed to start/stop a preview at all.
  realRole: Role;
  previewing: boolean;
  school: typeof schools.$inferSelect;
};

// Every dashboard page and server action funnels through this. Redirects to
// /login when signed out and to /setup when the school hasn't been created yet.
//
// Owner/Admin can "preview" any limited role (see actions/preview.ts) via a
// cookie — while it's set, `role` here becomes the previewed role for BOTH
// view and write checks, so the account genuinely can't do more than that
// role could. This is what lets an owner click through the app "as" a
// Registrar to see exactly what they'd see, instead of just reading about it.
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

  const realRole = member.role;
  const canPreview = realRole === "OWNER" || realRole === "ADMIN";
  const cookieStore = await cookies();
  const previewCookie = cookieStore.get(PREVIEW_COOKIE)?.value;
  const previewing = canPreview && !!previewCookie && PREVIEWABLE_ROLES.includes(previewCookie as Role);

  return {
    userId: session.user.id,
    schoolId: member.schoolId,
    staffId: member.id,
    role: previewing ? (previewCookie as Role) : realRole,
    realRole,
    previewing,
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
