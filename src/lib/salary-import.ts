import * as XLSX from "xlsx";

// Bulk salary import: one row per staff member, matched against existing
// staff by email (preferred, unique) or full name (fallback). This never
// creates staff — it only sets baseSalary for people already in Settings →
// Staff, since a salary with nobody to pay it to isn't useful data.

export type SalaryRow = { email: string; name: string; amount: string };

function norm(s: string): string {
  return String(s)
    .replace(/\([^)]*\)/g, "") // "New salary (EGP)" -> "New salary "
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.]+/g, " ");
}

const HEADER_ALIASES: Record<string, string> = {
  [norm("email")]: "email",
  [norm("e-mail")]: "email",
  [norm("staff email")]: "email",
  [norm("name")]: "name",
  [norm("staff name")]: "name",
  [norm("full name")]: "name",
  [norm("salary")]: "amount",
  [norm("amount")]: "amount",
  [norm("base salary")]: "amount",
  [norm("monthly salary")]: "amount",
  [norm("new salary")]: "amount",
};

export function parseSalaryWorkbook(buffer: ArrayBuffer): SalaryRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  if (matrix.length < 2) return [];

  const headerRow = matrix[0].map((h) => HEADER_ALIASES[norm(String(h))] ?? "");
  const rows: SalaryRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    if (!cells || cells.every((c) => c === "" || c == null)) continue;
    const row: Record<string, string> = {};
    headerRow.forEach((key, i) => {
      if (!key) return;
      row[key] = String(cells[i] ?? "").trim();
    });
    if (row.email || row.name) {
      rows.push({ email: (row.email ?? "").toLowerCase(), name: row.name ?? "", amount: row.amount ?? "" });
    }
  }
  return rows;
}

export function buildSalaryTemplateWorkbook(
  staffList: { name: string; email: string }[],
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const rows = [["Staff email", "Staff name", "New salary (EGP)"]];
  for (const s of staffList) rows.push([s.email, s.name, ""]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, "Salaries");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}
