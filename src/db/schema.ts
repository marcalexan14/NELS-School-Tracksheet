import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  numeric,
  boolean,
  integer,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const id = () => text("id").primaryKey().$defaultFn(() => createId());

// ---------- Enums ----------

// Staff permissions. OWNER is created on first-run setup and cannot be removed.
export const roleEnum = pgEnum("role", [
  "OWNER",
  "ADMIN",
  "REGISTRAR",
  "ACCOUNTANT",
  "TEACHER",
  "VIEWER",
]);

// The four stages of the Egyptian national ladder (نظام التعليم المصري).
export const stageKeyEnum = pgEnum("stage_key", [
  "KG",
  "PRIMARY",
  "PREPARATORY",
  "SECONDARY",
]);

export const genderEnum = pgEnum("gender", ["MALE", "FEMALE"]);

export const religionEnum = pgEnum("religion", ["MUSLIM", "CHRISTIAN", "OTHER"]);

export const studentStatusEnum = pgEnum("student_status", [
  "APPLICANT",
  "ENROLLED",
  "GRADUATED",
  "WITHDRAWN",
  "TRANSFERRED",
]);

export const guardianRelationEnum = pgEnum("guardian_relation", [
  "FATHER",
  "MOTHER",
  "GRANDPARENT",
  "SIBLING",
  "UNCLE_AUNT",
  "LEGAL_GUARDIAN",
  "OTHER",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "ACTIVE",
  "COMPLETED",
  "WITHDRAWN",
]);

export const documentKindEnum = pgEnum("document_kind", [
  "BIRTH_CERTIFICATE",
  "NATIONAL_ID",
  "PHOTO",
  "TRANSFER_PAPERS",
  "PREVIOUS_REPORT",
  "MEDICAL",
  "VACCINATION",
  "OTHER",
]);

// Categories a fee line can belong to — drives reporting breakdowns.
export const feeCategoryEnum = pgEnum("fee_category", [
  "TUITION",
  "REGISTRATION",
  "TRANSPORT",
  "BOOKS",
  "UNIFORM",
  "ACTIVITIES",
  "EXAMS",
  "MEALS",
  "OTHER",
]);

export const feeStatusEnum = pgEnum("fee_status", [
  "PENDING",
  "PARTIAL",
  "PAID",
  "WAIVED",
  "OVERDUE",
]);

export const installmentStatusEnum = pgEnum("installment_status", [
  "DUE",
  "PARTIAL",
  "PAID",
  "OVERDUE",
]);

export const discountKindEnum = pgEnum("discount_kind", [
  "SIBLING",
  "STAFF_CHILD",
  "MERIT",
  "HARDSHIP",
  "EARLY_PAYMENT",
  "OTHER",
]);

export const discountBasisEnum = pgEnum("discount_basis", ["PERCENT", "AMOUNT"]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "INSTAPAY",
  "BANK_TRANSFER",
  "CHEQUE",
  "CARD",
  "OTHER",
]);

// ---------- Auth ----------

export const users = pgTable("users", {
  id: id(),
  name: text("name"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (t) => [uniqueIndex("oauth_provider_account_idx").on(t.provider, t.providerAccountId)],
);

export const sessions = pgTable("sessions", {
  id: id(),
  sessionToken: text("session_token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

// ---------- School (single tenant, one row) ----------

export const schools = pgTable("schools", {
  id: id(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  logoUrl: text("logo_url"),
  accentColor: text("accent_color").notNull().default("#147c70"),
  baseCurrency: text("base_currency").notNull().default("EGP"),
  // UI language: "en" or "ar" (Arabic switches the whole app to RTL).
  locale: text("locale").notNull().default("en"),
  // Egyptian schools report to the local Idara / Muderiya — free text is enough.
  educationDirectorate: text("education_directorate"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const staff = pgTable(
  "staff",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("VIEWER"),
    title: text("title"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("staff_school_user_idx").on(t.schoolId, t.userId)],
);

// ---------- Academic calendar ----------

export const academicYears = pgTable(
  "academic_years",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    // Egyptian convention: "2025 / 2026".
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("academic_year_school_name_idx").on(t.schoolId, t.name)],
);

export const terms = pgTable("terms", {
  id: id(),
  academicYearId: text("academic_year_id")
    .notNull()
    .references(() => academicYears.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  ordinal: integer("ordinal").notNull().default(1),
});

// ---------- Grade ladder ----------

export const stages = pgTable(
  "stages",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    key: stageKeyEnum("key").notNull(),
    name: text("name").notNull(),
    nameAr: text("name_ar").notNull(),
    ordinal: integer("ordinal").notNull(),
  },
  (t) => [uniqueIndex("stage_school_key_idx").on(t.schoolId, t.key)],
);

export const gradeLevels = pgTable(
  "grade_levels",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameAr: text("name_ar").notNull(),
    // Global order across the whole ladder: KG1 = 1 … Secondary 3 = 14.
    ordinal: integer("ordinal").notNull(),
  },
  (t) => [uniqueIndex("grade_level_school_ordinal_idx").on(t.schoolId, t.ordinal)],
);

// A section of a grade for one academic year, e.g. "Primary 1 / 1-A".
export const classrooms = pgTable(
  "classrooms",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    gradeLevelId: text("grade_level_id")
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull().default(30),
    homeroomTeacherId: text("homeroom_teacher_id").references(() => staff.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("classroom_year_grade_name_idx").on(t.academicYearId, t.gradeLevelId, t.name),
    index("classroom_year_idx").on(t.academicYearId),
  ],
);

// ---------- Students ----------

export const students = pgTable(
  "students",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    // Human-facing school ID, e.g. "NIS-2025-0417".
    code: text("code").notNull(),
    // 14-digit Egyptian national ID (الرقم القومي). Optional for young KG pupils.
    nationalId: text("national_id"),
    // Egyptian records use the four-part name (الاسم رباعي).
    firstName: text("first_name").notNull(),
    secondName: text("second_name"),
    thirdName: text("third_name"),
    familyName: text("family_name").notNull(),
    latinName: text("latin_name"),
    gender: genderEnum("gender").notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    birthGovernorate: text("birth_governorate"),
    nationality: text("nationality").notNull().default("Egyptian"),
    religion: religionEnum("religion"),
    address: text("address"),
    photoUrl: text("photo_url"),
    status: studentStatusEnum("status").notNull().default("APPLICANT"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("student_school_code_idx").on(t.schoolId, t.code),
    index("student_school_status_idx").on(t.schoolId, t.status),
    index("student_family_name_idx").on(t.familyName),
  ],
);

export const guardians = pgTable(
  "guardians",
  {
    id: id(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    relation: guardianRelationEnum("relation").notNull(),
    name: text("name").notNull(),
    nationalId: text("national_id"),
    phone: text("phone").notNull(),
    altPhone: text("alt_phone"),
    email: text("email"),
    occupation: text("occupation"),
    workplace: text("workplace"),
    isPrimaryContact: boolean("is_primary_contact").notNull().default(false),
    isEmergencyContact: boolean("is_emergency_contact").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("guardian_student_idx").on(t.studentId)],
);

export const studentDocuments = pgTable(
  "student_documents",
  {
    id: id(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    kind: documentKindEnum("kind").notNull(),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    mimeType: text("mime_type").notNull(),
    note: text("note"),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  },
  (t) => [index("student_document_student_idx").on(t.studentId)],
);

// One row per student per academic year: which grade and section they sat in.
export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    gradeLevelId: text("grade_level_id")
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "cascade" }),
    classroomId: text("classroom_id").references(() => classrooms.id, { onDelete: "set null" }),
    enrollmentDate: date("enrollment_date").notNull(),
    previousSchool: text("previous_school"),
    status: enrollmentStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("enrollment_student_year_idx").on(t.studentId, t.academicYearId),
    index("enrollment_year_grade_idx").on(t.academicYearId, t.gradeLevelId),
  ],
);

// ---------- Fees ----------

// Named fee types the school charges. Amounts live on plans, not here.
export const feeItems = pgTable(
  "fee_items",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameAr: text("name_ar"),
    category: feeCategoryEnum("category").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("fee_item_school_name_idx").on(t.schoolId, t.name)],
);

// The fee schedule for one grade in one academic year.
export const feePlans = pgTable(
  "fee_plans",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    gradeLevelId: text("grade_level_id")
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "cascade" }),
    // How many instalments the tuition is split into for this grade/year.
    installmentCount: integer("installment_count").notNull().default(1),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("fee_plan_year_grade_idx").on(t.academicYearId, t.gradeLevelId)],
);

export const feePlanLines = pgTable("fee_plan_lines", {
  id: id(),
  feePlanId: text("fee_plan_id")
    .notNull()
    .references(() => feePlans.id, { onDelete: "cascade" }),
  feeItemId: text("fee_item_id")
    .notNull()
    .references(() => feeItems.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  // Mandatory lines are billed to every student; optional ones (bus, meals)
  // are only billed when added to that student's enrollment.
  mandatory: boolean("mandatory").notNull().default(true),
  // Only tuition-type lines are split into instalments.
  splitIntoInstallments: boolean("split_into_installments").notNull().default(false),
});

// A concrete charge on one student for one academic year.
export const studentFees = pgTable(
  "student_fees",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    feeItemId: text("fee_item_id")
      .notNull()
      .references(() => feeItems.id, { onDelete: "cascade" }),
    grossAmount: numeric("gross_amount", { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    discountReason: text("discount_reason"),
    netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
    dueDate: date("due_date").notNull(),
    status: feeStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("student_fee_student_year_idx").on(t.studentId, t.academicYearId),
    index("student_fee_year_status_idx").on(t.academicYearId, t.status),
    uniqueIndex("student_fee_enrollment_item_idx").on(t.enrollmentId, t.feeItemId),
  ],
);

export const installments = pgTable(
  "installments",
  {
    id: id(),
    studentFeeId: text("student_fee_id")
      .notNull()
      .references(() => studentFees.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    dueDate: date("due_date").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    status: installmentStatusEnum("status").notNull().default("DUE"),
  },
  (t) => [
    uniqueIndex("installment_fee_seq_idx").on(t.studentFeeId, t.sequence),
    index("installment_due_idx").on(t.dueDate),
  ],
);

export const discounts = pgTable(
  "discounts",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    kind: discountKindEnum("kind").notNull(),
    basis: discountBasisEnum("basis").notNull(),
    value: numeric("value", { precision: 12, scale: 2 }).notNull(),
    // Restrict a discount to one fee category (usually TUITION); null = all.
    appliesToCategory: feeCategoryEnum("applies_to_category"),
    note: text("note"),
    approvedByStaffId: text("approved_by_staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("discount_student_year_idx").on(t.studentId, t.academicYearId)],
);

// ---------- Payments ----------

export const payments = pgTable(
  "payments",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    receiptNumber: text("receipt_number").notNull(),
    paidOn: date("paid_on").notNull(),
    method: paymentMethodEnum("method").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    reference: text("reference"),
    note: text("note"),
    receivedByStaffId: text("received_by_staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_school_receipt_idx").on(t.schoolId, t.receiptNumber),
    index("payment_student_idx").on(t.studentId),
    index("payment_year_date_idx").on(t.academicYearId, t.paidOn),
  ],
);

// Splits one payment across the fees / instalments it settles.
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: id(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    studentFeeId: text("student_fee_id")
      .notNull()
      .references(() => studentFees.id, { onDelete: "cascade" }),
    installmentId: text("installment_id").references(() => installments.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [
    index("allocation_payment_idx").on(t.paymentId),
    index("allocation_fee_idx").on(t.studentFeeId),
  ],
);

// ---------- Relations ----------

export const usersRelations = relations(users, ({ many }) => ({
  staff: many(staff),
  sessions: many(sessions),
  oauthAccounts: many(oauthAccounts),
}));

export const schoolsRelations = relations(schools, ({ many }) => ({
  staff: many(staff),
  academicYears: many(academicYears),
  stages: many(stages),
  gradeLevels: many(gradeLevels),
  students: many(students),
  feeItems: many(feeItems),
  payments: many(payments),
}));

export const staffRelations = relations(staff, ({ one }) => ({
  school: one(schools, { fields: [staff.schoolId], references: [schools.id] }),
  user: one(users, { fields: [staff.userId], references: [users.id] }),
}));

export const academicYearsRelations = relations(academicYears, ({ one, many }) => ({
  school: one(schools, { fields: [academicYears.schoolId], references: [schools.id] }),
  terms: many(terms),
  classrooms: many(classrooms),
  enrollments: many(enrollments),
}));

export const termsRelations = relations(terms, ({ one }) => ({
  academicYear: one(academicYears, {
    fields: [terms.academicYearId],
    references: [academicYears.id],
  }),
}));

export const stagesRelations = relations(stages, ({ one, many }) => ({
  school: one(schools, { fields: [stages.schoolId], references: [schools.id] }),
  gradeLevels: many(gradeLevels),
}));

export const gradeLevelsRelations = relations(gradeLevels, ({ one, many }) => ({
  school: one(schools, { fields: [gradeLevels.schoolId], references: [schools.id] }),
  stage: one(stages, { fields: [gradeLevels.stageId], references: [stages.id] }),
  classrooms: many(classrooms),
  enrollments: many(enrollments),
}));

export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  school: one(schools, { fields: [classrooms.schoolId], references: [schools.id] }),
  academicYear: one(academicYears, {
    fields: [classrooms.academicYearId],
    references: [academicYears.id],
  }),
  gradeLevel: one(gradeLevels, {
    fields: [classrooms.gradeLevelId],
    references: [gradeLevels.id],
  }),
  homeroomTeacher: one(staff, {
    fields: [classrooms.homeroomTeacherId],
    references: [staff.id],
  }),
  enrollments: many(enrollments),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, { fields: [students.schoolId], references: [schools.id] }),
  guardians: many(guardians),
  documents: many(studentDocuments),
  enrollments: many(enrollments),
  fees: many(studentFees),
  payments: many(payments),
  discounts: many(discounts),
}));

export const guardiansRelations = relations(guardians, ({ one }) => ({
  student: one(students, { fields: [guardians.studentId], references: [students.id] }),
}));

export const studentDocumentsRelations = relations(studentDocuments, ({ one }) => ({
  student: one(students, { fields: [studentDocuments.studentId], references: [students.id] }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  school: one(schools, { fields: [enrollments.schoolId], references: [schools.id] }),
  student: one(students, { fields: [enrollments.studentId], references: [students.id] }),
  academicYear: one(academicYears, {
    fields: [enrollments.academicYearId],
    references: [academicYears.id],
  }),
  gradeLevel: one(gradeLevels, {
    fields: [enrollments.gradeLevelId],
    references: [gradeLevels.id],
  }),
  classroom: one(classrooms, {
    fields: [enrollments.classroomId],
    references: [classrooms.id],
  }),
  fees: many(studentFees),
}));

export const feeItemsRelations = relations(feeItems, ({ one, many }) => ({
  school: one(schools, { fields: [feeItems.schoolId], references: [schools.id] }),
  planLines: many(feePlanLines),
}));

export const feePlansRelations = relations(feePlans, ({ one, many }) => ({
  school: one(schools, { fields: [feePlans.schoolId], references: [schools.id] }),
  academicYear: one(academicYears, {
    fields: [feePlans.academicYearId],
    references: [academicYears.id],
  }),
  gradeLevel: one(gradeLevels, {
    fields: [feePlans.gradeLevelId],
    references: [gradeLevels.id],
  }),
  lines: many(feePlanLines),
}));

export const feePlanLinesRelations = relations(feePlanLines, ({ one }) => ({
  feePlan: one(feePlans, { fields: [feePlanLines.feePlanId], references: [feePlans.id] }),
  feeItem: one(feeItems, { fields: [feePlanLines.feeItemId], references: [feeItems.id] }),
}));

export const studentFeesRelations = relations(studentFees, ({ one, many }) => ({
  school: one(schools, { fields: [studentFees.schoolId], references: [schools.id] }),
  student: one(students, { fields: [studentFees.studentId], references: [students.id] }),
  enrollment: one(enrollments, {
    fields: [studentFees.enrollmentId],
    references: [enrollments.id],
  }),
  academicYear: one(academicYears, {
    fields: [studentFees.academicYearId],
    references: [academicYears.id],
  }),
  feeItem: one(feeItems, { fields: [studentFees.feeItemId], references: [feeItems.id] }),
  installments: many(installments),
  allocations: many(paymentAllocations),
}));

export const installmentsRelations = relations(installments, ({ one, many }) => ({
  studentFee: one(studentFees, {
    fields: [installments.studentFeeId],
    references: [studentFees.id],
  }),
  allocations: many(paymentAllocations),
}));

export const discountsRelations = relations(discounts, ({ one }) => ({
  school: one(schools, { fields: [discounts.schoolId], references: [schools.id] }),
  student: one(students, { fields: [discounts.studentId], references: [students.id] }),
  academicYear: one(academicYears, {
    fields: [discounts.academicYearId],
    references: [academicYears.id],
  }),
  approvedBy: one(staff, { fields: [discounts.approvedByStaffId], references: [staff.id] }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  school: one(schools, { fields: [payments.schoolId], references: [schools.id] }),
  student: one(students, { fields: [payments.studentId], references: [students.id] }),
  academicYear: one(academicYears, {
    fields: [payments.academicYearId],
    references: [academicYears.id],
  }),
  receivedBy: one(staff, { fields: [payments.receivedByStaffId], references: [staff.id] }),
  allocations: many(paymentAllocations),
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(payments, { fields: [paymentAllocations.paymentId], references: [payments.id] }),
  studentFee: one(studentFees, {
    fields: [paymentAllocations.studentFeeId],
    references: [studentFees.id],
  }),
  installment: one(installments, {
    fields: [paymentAllocations.installmentId],
    references: [installments.id],
  }),
}));
