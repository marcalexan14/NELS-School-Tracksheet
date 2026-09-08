import * as XLSX from "xlsx";

// ---------- Template ----------

export type TemplateColumn = {
  key: string;
  header: string;
  required: boolean;
  example: string;
  note?: string;
};

export const TEMPLATE_COLUMNS: TemplateColumn[] = [
  { key: "first_name", header: "First name", required: true, example: "يوسف" },
  { key: "father_name", header: "Father's name", required: false, example: "أحمد" },
  { key: "grandfather_name", header: "Grandfather's name", required: false, example: "محمد" },
  { key: "family_name", header: "Family name", required: true, example: "علي" },
  { key: "name_en", header: "Name in English", required: false, example: "Youssef Ahmed Mohamed Ali" },
  { key: "national_id", header: "National ID", required: false, example: "30001011234567", note: "14 digits, or leave blank" },
  { key: "gender", header: "Gender", required: true, example: "male", note: "male / female  (or  ذكر / أنثى)" },
  { key: "date_of_birth", header: "Date of birth", required: true, example: "2015-09-01", note: "YYYY-MM-DD  or  DD/MM/YYYY" },
  { key: "religion", header: "Religion", required: false, example: "muslim", note: "muslim / christian / other" },
  { key: "nationality", header: "Nationality", required: false, example: "Egyptian" },
  { key: "birth_governorate", header: "Birth governorate", required: false, example: "Cairo" },
  { key: "address", header: "Address", required: false, example: "12 El Nozha St, Heliopolis" },
  { key: "grade", header: "Grade", required: false, example: "Primary 1", note: "enrols the student for the current year — see the Grades sheet" },
  { key: "classroom", header: "Class", required: false, example: "1-A" },
  { key: "guardian_name", header: "Guardian name", required: true, example: "أحمد محمد علي" },
  { key: "guardian_relation", header: "Guardian relation", required: false, example: "father", note: "father / mother / grandparent / legal_guardian / other" },
  { key: "guardian_phone", header: "Guardian phone", required: true, example: "01012345678" },
  { key: "guardian_email", header: "Guardian email", required: false, example: "ahmed@example.com" },
  { key: "guardian_occupation", header: "Guardian occupation", required: false, example: "مهندس" },
];

// Header text -> column key. Accepts the template headers plus common variants.
const HEADER_ALIASES: Record<string, string> = {};
for (const c of TEMPLATE_COLUMNS) {
  HEADER_ALIASES[norm(c.header)] = c.key;
  HEADER_ALIASES[norm(c.key)] = c.key;
}
Object.assign(HEADER_ALIASES, {
  [norm("second name")]: "father_name",
  [norm("father")]: "father_name",
  [norm("third name")]: "grandfather_name",
  [norm("grandfather")]: "grandfather_name",
  [norm("last name")]: "family_name",
  [norm("surname")]: "family_name",
  [norm("english name")]: "name_en",
  [norm("latin name")]: "name_en",
  [norm("name (english)")]: "name_en",
  [norm("nid")]: "national_id",
  [norm("national number")]: "national_id",
  [norm("الرقم القومي")]: "national_id",
  [norm("sex")]: "gender",
  [norm("النوع")]: "gender",
  [norm("dob")]: "date_of_birth",
  [norm("birth date")]: "date_of_birth",
  [norm("تاريخ الميلاد")]: "date_of_birth",
  [norm("الديانة")]: "religion",
  [norm("الجنسية")]: "nationality",
  [norm("class")]: "classroom",
  [norm("section")]: "classroom",
  [norm("الصف")]: "grade",
  [norm("الفصل")]: "classroom",
  [norm("guardian")]: "guardian_name",
  [norm("parent name")]: "guardian_name",
  [norm("ولي الأمر")]: "guardian_name",
  [norm("phone")]: "guardian_phone",
  [norm("mobile")]: "guardian_phone",
  [norm("الهاتف")]: "guardian_phone",
  [norm("email")]: "guardian_email",
  [norm("relation")]: "guardian_relation",
  [norm("occupation")]: "guardian_occupation",
});

function norm(s: string): string {
  return String(s).trim().toLowerCase().replace(/[\s_\-.]+/g, " ");
}

// ---------- Parsing ----------

export type RawRow = Record<string, string>;

export function parseWorkbook(buffer: ArrayBuffer): RawRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  if (matrix.length < 2) return [];

  const headerRow = matrix[0].map((h) => HEADER_ALIASES[norm(String(h))] ?? "");
  const rows: RawRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    if (!cells || cells.every((c) => c === "" || c == null)) continue;
    const row: RawRow = {};
    headerRow.forEach((key, i) => {
      if (!key) return;
      const v = cells[i];
      row[key] = v instanceof Date ? toIsoDate(v) : String(v ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

// ---------- Normalisation + validation ----------

export type GradeRef = { id: string; name: string; nameAr: string };
export type ClassroomRef = { id: string; name: string; gradeLevelId: string };

export type NormalizedStudent = {
  firstName: string;
  secondName: string | null;
  thirdName: string | null;
  familyName: string;
  latinName: string | null;
  nationalId: string | null;
  gender: "MALE" | "FEMALE";
  dateOfBirth: string;
  religion: "MUSLIM" | "CHRISTIAN" | "OTHER" | null;
  nationality: string;
  birthGovernorate: string | null;
  address: string | null;
  gradeLevelId: string | null;
  classroomId: string | null;
  guardianName: string;
  guardianRelation: "FATHER" | "MOTHER" | "GRANDPARENT" | "LEGAL_GUARDIAN" | "OTHER";
  guardianPhone: string;
  guardianEmail: string | null;
  guardianOccupation: string | null;
};

export type RowResult = {
  rowNumber: number;
  display: { name: string; grade: string; guardian: string };
  data: NormalizedStudent | null;
  errors: string[];
};

const GENDER: Record<string, "MALE" | "FEMALE"> = {
  m: "MALE", male: "MALE", boy: "MALE", "ذكر": "MALE", "ولد": "MALE",
  f: "FEMALE", female: "FEMALE", girl: "FEMALE", "أنثى": "FEMALE", "انثى": "FEMALE", "بنت": "FEMALE",
};
const RELIGION: Record<string, "MUSLIM" | "CHRISTIAN" | "OTHER"> = {
  muslim: "MUSLIM", islam: "MUSLIM", "مسلم": "MUSLIM", "مسلمة": "MUSLIM",
  christian: "CHRISTIAN", coptic: "CHRISTIAN", "مسيحي": "CHRISTIAN", "مسيحية": "CHRISTIAN", "مسيحى": "CHRISTIAN",
  other: "OTHER", "أخرى": "OTHER",
};
const RELATION: Record<string, NormalizedStudent["guardianRelation"]> = {
  father: "FATHER", dad: "FATHER", "أب": "FATHER", "الأب": "FATHER", "والد": "FATHER",
  mother: "MOTHER", mom: "MOTHER", "أم": "MOTHER", "الأم": "MOTHER", "والدة": "MOTHER",
  grandparent: "GRANDPARENT", grandfather: "GRANDPARENT", grandmother: "GRANDPARENT", "جد": "GRANDPARENT", "جدة": "GRANDPARENT",
  "legal guardian": "LEGAL_GUARDIAN", guardian: "LEGAL_GUARDIAN", "وصي": "LEGAL_GUARDIAN",
  other: "OTHER", "أخرى": "OTHER",
};

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Accepts ISO, DD/MM/YYYY, D-M-YYYY, and Excel serial numbers.
function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // Year-first: 2016-03-15, 2016/03/15, 2016.3.5
  const ymd = s.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd.map(Number);
    return isValid(y, m, d) ? iso(y, m, d) : null;
  }
  const dm = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (dm) {
    const a = Number(dm[1]);
    const b = Number(dm[2]);
    let year = Number(dm[3]);
    if (year < 100) year += year > 30 ? 1900 : 2000;
    // Egyptian convention is day-first; only fall back to month-first when the
    // first number can't be a day.
    const [day, month] = b > 12 && a <= 12 ? [b, a] : [a, b];
    return isValid(year, month, day) ? iso(year, month, day) : null;
  }
  if (/^\d{4,6}$/.test(s)) {
    // Excel serial date (days since 1899-12-30)
    const serial = Number(s);
    const ms = (serial - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return toIsoDate(d);
  }
  return null;
}
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const isValid = (y: number, m: number, d: number) =>
  y >= 1990 && y <= new Date().getFullYear() && m >= 1 && m <= 12 && d >= 1 && d <= 31;

// Grade text -> id. Matches template name, Arabic name, and loose variants.
function matchGrade(raw: string, grades: GradeRef[]): GradeRef | null {
  const s = norm(raw);
  if (!s) return null;
  for (const g of grades) {
    if (norm(g.name) === s || norm(g.nameAr) === s) return g;
  }
  // "kg1" / "kg 1" / "k g 1"
  const compact = s.replace(/\s+/g, "");
  for (const g of grades) {
    if (norm(g.name).replace(/\s+/g, "") === compact) return g;
  }
  // "grade 1" / "1 primary" / "primary1" / "p1"
  const num = s.match(/\d+/)?.[0];
  if (num) {
    if (/\bk(g|inder)/.test(s)) return grades.find((g) => norm(g.name) === `kg${num}`) ?? null;
    if (/prim|ابتدا/.test(s)) return grades.find((g) => norm(g.name) === `primary ${num}`) ?? null;
    if (/prep|اعداد|إعداد/.test(s)) return grades.find((g) => norm(g.name) === `prep ${num}`) ?? null;
    if (/sec|ثانو/.test(s)) return grades.find((g) => norm(g.name) === `secondary ${num}`) ?? null;
  }
  return null;
}

export function normalizeRow(
  raw: RawRow,
  rowNumber: number,
  grades: GradeRef[],
  classrooms: ClassroomRef[],
): RowResult {
  const errors: string[] = [];
  const get = (k: string) => (raw[k] ?? "").trim();

  const firstName = get("first_name");
  const familyName = get("family_name");
  if (!firstName) errors.push("First name is required");
  if (!familyName) errors.push("Family name is required");

  const genderRaw = norm(get("gender"));
  const gender = GENDER[genderRaw];
  if (!gender) errors.push(get("gender") ? `Gender "${get("gender")}" not recognised` : "Gender is required");

  const dateOfBirth = parseDate(get("date_of_birth"));
  if (!dateOfBirth) errors.push(get("date_of_birth") ? `Date of birth "${get("date_of_birth")}" not understood` : "Date of birth is required");

  let nationalId: string | null = get("national_id").replace(/\D/g, "") || null;
  if (nationalId && nationalId.length !== 14) {
    errors.push(`National ID must be 14 digits (got ${nationalId.length})`);
    nationalId = null;
  }

  const religionRaw = norm(get("religion"));
  const religion = religionRaw ? RELIGION[religionRaw] ?? null : null;
  if (religionRaw && !religion) errors.push(`Religion "${get("religion")}" not recognised`);

  let grade: GradeRef | null = null;
  if (get("grade")) {
    grade = matchGrade(get("grade"), grades);
    if (!grade) errors.push(`Grade "${get("grade")}" not found`);
  }

  let classroomId: string | null = null;
  if (grade && get("classroom")) {
    const cls = classrooms.find(
      (c) => c.gradeLevelId === grade!.id && norm(c.name) === norm(get("classroom")),
    );
    if (cls) classroomId = cls.id;
    // A missing class is a warning, not an error — the student just stays unassigned.
  }

  const guardianName = get("guardian_name");
  const guardianPhone = get("guardian_phone").replace(/[^\d+]/g, "");
  if (!guardianName) errors.push("Guardian name is required");
  if (!guardianPhone) errors.push("Guardian phone is required");

  const relationRaw = norm(get("guardian_relation"));
  const guardianRelation = relationRaw ? RELATION[relationRaw] ?? "OTHER" : "FATHER";

  const data: NormalizedStudent | null = errors.length
    ? null
    : {
        firstName,
        secondName: get("father_name") || null,
        thirdName: get("grandfather_name") || null,
        familyName,
        latinName: get("name_en") || null,
        nationalId,
        gender: gender!,
        dateOfBirth: dateOfBirth!,
        religion,
        nationality: get("nationality") || "Egyptian",
        birthGovernorate: get("birth_governorate") || null,
        address: get("address") || null,
        gradeLevelId: grade?.id ?? null,
        classroomId,
        guardianName,
        guardianRelation,
        guardianPhone,
        guardianEmail: get("guardian_email") || null,
        guardianOccupation: get("guardian_occupation") || null,
      };

  return {
    rowNumber,
    display: {
      name: [firstName, get("father_name"), get("grandfather_name"), familyName].filter(Boolean).join(" "),
      grade: grade ? grade.name : get("grade") || "—",
      guardian: guardianName || "—",
    },
    data,
    errors,
  };
}

// ---------- Template file ----------

export function buildTemplateWorkbook(grades: GradeRef[]): Uint8Array {
  const wb = XLSX.utils.book_new();

  const headers = TEMPLATE_COLUMNS.map((c) => c.header);
  const example = TEMPLATE_COLUMNS.map((c) => c.example);
  const notes = TEMPLATE_COLUMNS.map((c) => (c.required ? "REQUIRED" : c.note ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([headers, example, notes]);
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, "Students");

  const gradeRows = [["Grade name (use in the Grade column)", "الاسم بالعربية"]];
  for (const g of grades) gradeRows.push([g.name, g.nameAr]);
  const gws = XLSX.utils.aoa_to_sheet(gradeRows);
  gws["!cols"] = [{ wch: 40 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, gws, "Grades");

  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}
