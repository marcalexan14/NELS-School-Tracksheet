"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { staff, salaryAdjustments } from "@/db/schema";
import { requireCan } from "@/lib/session";
import { fromPiastres } from "@/lib/money";
import { parseSalaryWorkbook } from "@/lib/salary-import";

function round2(amount: number): string {
  return fromPiastres(Math.round(amount * 100));
}

async function logAdjustment(args: {
  schoolId: string;
  staffId: string;
  previousAmount: string | null;
  newAmount: string;
  percent?: number;
  note?: string;
  changedByStaffId: string;
}) {
  await db.insert(salaryAdjustments).values({
    schoolId: args.schoolId,
    staffId: args.staffId,
    previousAmount: args.previousAmount,
    newAmount: args.newAmount,
    percent: args.percent != null ? String(args.percent) : null,
    note: args.note ?? null,
    changedByStaffId: args.changedByStaffId,
  });
}

// One cell of the salary grid — set an exact amount. Called directly from
// the client (not a <form>), like the enrolment roster editor.
export async function updateSalaryAction(input: {
  staffId: string;
  amount: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireCan("salaries");

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Enter a valid amount." };

  const row = await db.query.staff.findFirst({
    where: and(eq(staff.id, input.staffId), eq(staff.schoolId, ctx.schoolId)),
  });
  if (!row) return { ok: false, error: "Unknown staff member." };

  const newAmount = round2(amount);
  await db.update(staff).set({ baseSalary: newAmount }).where(eq(staff.id, row.id));
  await logAdjustment({
    schoolId: ctx.schoolId,
    staffId: row.id,
    previousAmount: row.baseSalary,
    newAmount,
    changedByStaffId: ctx.staffId,
  });

  revalidatePath("/dashboard/salaries");
  return { ok: true };
}

// Raise every staff member's current salary by a percentage in one go
// ("give everyone a 10% raise"). Only touches people who already have a
// salary set — 0 is not the same as "no salary yet".
export async function bulkIncreaseSalariesAction(input: {
  percent: number;
  staffIds?: string[];
}): Promise<{ ok: boolean; updated: number; error?: string }> {
  const ctx = await requireCan("salaries");
  if (!Number.isFinite(input.percent) || input.percent === 0) {
    return { ok: false, updated: 0, error: "Enter a non-zero percentage." };
  }

  const rows = await db.query.staff.findMany({
    where: and(
      eq(staff.schoolId, ctx.schoolId),
      isNotNull(staff.baseSalary),
      input.staffIds?.length ? inArray(staff.id, input.staffIds) : undefined,
    ),
  });
  if (!rows.length) return { ok: false, updated: 0, error: "No staff with a salary set yet." };

  for (const row of rows) {
    const previous = Number(row.baseSalary);
    const newAmount = round2(previous * (1 + input.percent / 100));
    await db.update(staff).set({ baseSalary: newAmount }).where(eq(staff.id, row.id));
    await logAdjustment({
      schoolId: ctx.schoolId,
      staffId: row.id,
      previousAmount: row.baseSalary,
      newAmount,
      percent: input.percent,
      note: `Bulk ${input.percent > 0 ? "increase" : "decrease"}`,
      changedByStaffId: ctx.staffId,
    });
  }

  revalidatePath("/dashboard/salaries");
  return { ok: true, updated: rows.length };
}

export type SalaryImportState = {
  done: boolean;
  updated: number;
  unmatched: string[];
  error?: string;
};

const emptyImport: SalaryImportState = { done: false, updated: 0, unmatched: [] };

export async function importSalariesAction(
  _prev: SalaryImportState,
  formData: FormData,
): Promise<SalaryImportState> {
  const ctx = await requireCan("salaries");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...emptyImport, done: true, error: "Choose an .xlsx or .csv file." };
  }
  if (file.size > 3 * 1024 * 1024) {
    return { ...emptyImport, done: true, error: "File is larger than 3 MB." };
  }

  let rows;
  try {
    rows = parseSalaryWorkbook(await file.arrayBuffer());
  } catch {
    return { ...emptyImport, done: true, error: "Couldn't read that file. Save it as .xlsx and try again." };
  }
  if (!rows.length) {
    return { ...emptyImport, done: true, error: "No rows found. Use the template and keep the header row." };
  }

  const staffRows = await db.query.staff.findMany({
    where: eq(staff.schoolId, ctx.schoolId),
    with: { user: { columns: { name: true, email: true } } },
  });
  const byEmail = new Map(staffRows.map((s) => [s.user.email.toLowerCase(), s]));
  const byName = new Map(staffRows.map((s) => [(s.user.name ?? "").trim().toLowerCase(), s]));

  let updated = 0;
  const unmatched: string[] = [];

  for (const row of rows) {
    const amount = Number(row.amount);
    if (!row.amount || !Number.isFinite(amount) || amount < 0) continue;

    const match = (row.email && byEmail.get(row.email)) || (row.name && byName.get(row.name.trim().toLowerCase()));
    if (!match) {
      unmatched.push(row.name || row.email || "(blank row)");
      continue;
    }
    const newAmount = round2(amount);
    await db.update(staff).set({ baseSalary: newAmount }).where(eq(staff.id, match.id));
    await logAdjustment({
      schoolId: ctx.schoolId,
      staffId: match.id,
      previousAmount: match.baseSalary,
      newAmount,
      note: "Excel import",
      changedByStaffId: ctx.staffId,
    });
    updated += 1;
  }

  revalidatePath("/dashboard/salaries");
  return { done: true, updated, unmatched };
}
