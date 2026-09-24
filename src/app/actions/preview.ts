"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireStaff, PREVIEW_COOKIE, homeFor, type Role } from "@/lib/session";

const PREVIEWABLE: Role[] = ["REGISTRAR", "ACCOUNTANT", "TEACHER", "VIEWER"];

// Owner/Admin only — see requireStaff() for how this cookie changes what the
// rest of the app treats their role as, for as long as it's set.
export async function startPreviewAction(formData: FormData) {
  const ctx = await requireStaff();
  if (ctx.realRole !== "OWNER" && ctx.realRole !== "ADMIN") {
    throw new Error("Only Owner/Admin can preview another role.");
  }
  const role = String(formData.get("role") ?? "");
  if (!PREVIEWABLE.includes(role as Role)) throw new Error("Invalid role.");

  const store = await cookies();
  store.set(PREVIEW_COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(homeFor(role as Role));
}

export async function stopPreviewAction() {
  const store = await cookies();
  store.delete(PREVIEW_COOKIE);
  redirect("/dashboard");
}
