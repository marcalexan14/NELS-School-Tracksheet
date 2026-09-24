# NELS Tracking Sheet

The tracking system for the **New Egyptian Language School (NELS)** — a student
register and school-fee tracker for the **Egyptian national education system**,
Kindergarten (KG1) through Thanaweya Amma (Secondary 3).

Built for a single school with multiple staff users. Tracks the full student
database, per-grade fee plans, instalments, receipts, discounts, and income by
academic year, stage, grade, and fee type. English and Arabic (RTL) interface.

---

## What it does

| Area | Details |
|---|---|
| **Students** | Full register: four-part Arabic name + English name, 14-digit national ID, gender, date of birth, birth governorate, religion, nationality, address, photo, status (applicant / enrolled / graduated / withdrawn / transferred) — all editable after admission. Multiple guardians per student with relation, phones, occupation, primary + emergency contact flags — each editable or removable (a student always keeps at least one). Document slots (birth certificate, national ID, transfer papers, medical…). |
| **Admissions** | One form registers a student, their first guardian, and (optionally) enrols them into a grade for the current year. |
| **Excel import** | Download a template, fill one row per student, upload — every row is validated and previewed before commit. Matches English/Arabic headers, gender/religion/relation synonyms, several date formats; de-dupes on national ID. Creates student + guardian + optional enrolment. |
| **Academic calendar** | Choose the academic/fiscal year and its exact start/end dates (any calendar, not just Sep–Jun); 1–4 terms, split across the range and individually editable. Multiple years, one flagged current. The Egyptian grade ladder (KG1–KG2, Primary 1–6, Preparatory 1–3, Secondary 1–3) is seeded and shown in Settings. |
| **Enrolments** | A searchable/filterable roster per year. Create classes/sections ("1-A", "1-B"). Edit a placement inline (grade / class / status, no reload) or multi-select students and move them to a class in bulk. **Promote cohort** moves every active student up one grade into the next year; Secondary 3 students are marked graduated. |
| **Fees** | Named fee items (Tuition, Registration, Bus, Books, Uniform, Activities, Exams…) each in a category. Per-grade, per-year **fee plans** set the amounts, how many instalments tuition splits into, and which lines are mandatory. **Generate bills** creates the charges for every enrolled student who doesn't have them yet (idempotent). |
| **Discounts** | Sibling / staff-child / merit / hardship / early-payment, as a percentage or a fixed amount, optionally limited to one fee category, applied when bills are generated. Special cases: adjust a single student's charge after billing (set an exact amount, % off, or EGP off) and the unpaid instalments recalculate to match. |
| **Payments** | Record a payment (cash / InstaPay / bank transfer / cheque / card), auto-allocated across the student's open instalments oldest-due-first, or targeted at one fee. Every payment gets a sequential receipt number and a printable receipt. A mistaken payment can be **voided** (reason required) — it reverses the instalment/fee effect and is excluded from every total, but the receipt stays on file for the audit trail. |
| **Dashboard & reports** | Fees billed, collected, collection rate, outstanding, overdue instalments. Collections by month, billed vs collected by stage, outstanding by grade, income by fee type, income by grade, collections by payment method. Everything scoped to the academic year picked in the top bar. |
| **Staff & roles** | Owner, Admin, Registrar, Accountant, Teacher, Viewer. Each role gets its own scoped view, not just hidden buttons — a Registrar's sidebar only has Students/Admissions/Enrolments, an Accountant's only has Students/Fees/Payments, and signing in drops each role straight onto its own home screen. Only Owner/Admin see the school-wide Dashboard, Reports, Export, and Settings & staff. |
| **Preview as a role** | Owner/Admin can pick "Look like…" in the header and the whole app — nav, pages, and what can be saved — switches to exactly what that role sees, with an "Exit preview" banner always on screen. A quick way to check what a Registrar or Accountant actually has access to, without a second account. |
| **Quick PIN sign-in** | Set a 4–6 digit PIN per staff member in Settings. At `/login`, tap your name and type the PIN instead of an email + password — faster on a shared school computer, and needs no internet since it's checked against the local database. |
| **Salaries** | Owner/Admin only. One editable grid, one row per staff member — click any amount to edit it in place, like a spreadsheet cell. **Increase all by %** applies a raise (or cut) across everyone with a salary set, in one click. **Import from Excel** bulk-sets salaries, matched by staff email or name. Every change (manual, bulk, or imported) is logged with the before/after amount. |
| **Security** | Security headers (HSTS, frame-deny, nosniff, restrictive permissions-policy). Login lockout after 5 failed attempts (15 minutes, DB-backed) — shared between email and PIN sign-in. Duplicate national IDs rejected on admission and on edit. Every page is also guarded server-side by role, not just hidden in the sidebar. |
| **Export & backup** | Download every record as one multi-sheet Excel workbook (one sheet per table, readable columns + IDs), scoped to all years or one. Owner / Admin only. |
| **Language** | Settings toggles the whole app between English and Arabic. Arabic switches the layout to right-to-left. |

All money is in Egyptian pounds (EGP). Income figures are derived from the
payment records — there is no separate running total to fall out of sync.

---

## Tech

- **Next.js 16** (App Router, React Server Components, Server Actions, Turbopack)
- **PostgreSQL** via **Drizzle ORM** (`node-postgres`)
- **Auth.js v5** (credentials, JWT sessions)
- **Tailwind CSS v4** + shadcn / base-ui components, **Recharts**, **Framer Motion**
- For local development with no database to install: **PGlite** (WASM Postgres) via a small socket server

---

## Getting started

### Requirements

- Node.js 20+
- A PostgreSQL 14+ database **for production** (Neon, Supabase, Railway, RDS, or a
  local Postgres). Not needed for local development — see below.

### 1. Install

```bash
npm install --legacy-peer-deps
cp .env.example .env
npx auth secret        # writes AUTH_SECRET into .env
```

### 2. Database

**Local development — zero setup.** In one terminal:

```bash
npm run dev:db
```

That starts an embedded PostgreSQL (PGlite) on port 55432 with data in
`./.pgdata`. The default `DATABASE_URL` in `.env` already points at it.

**Production / staging.** Set `DATABASE_URL` in `.env` to your real database URL
instead, and skip `npm run dev:db`.

Then create the tables:

```bash
npm run db:push
```

### 3. Run

```bash
npm run dev            # http://localhost:3000
```

- First visit redirects to **`/setup`** — create the school and the owner
  account. This also seeds the Egyptian grade ladder, a first academic year with
  two terms, and default fee items.
- After that, `/login` with the owner credentials.

### 4. (Optional) Load demo data

With the dev server running:

```bash
curl http://localhost:3000/api/dev/seed
```

Creates a demo school ("New Egyptian Language School"), ~90 students with
guardians and enrolments across every grade, fee plans, generated bills, and a
spread of payments. Log in with **`admin@nels.test`** / **`password123`**.
`?reset` rebuilds it. This route is disabled when `NODE_ENV=production`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run dev:db` | Embedded PGlite database on :55432 (local dev only) |
| `npm run db:push` | Create / update tables from `src/db/schema.ts` |
| `npm run db:studio` | Drizzle Studio (browse the database) |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

---

## Deploying

**[DEPLOY.md](DEPLOY.md)** has the full 5-minute path (Neon + Vercel). In short:

1. Create a Postgres database (Neon, Supabase, RDS…) and get its connection string.
2. `DATABASE_URL=<string> npm run db:push` — once, to create the tables.
3. Import the repo to Vercel; set `DATABASE_URL`, `AUTH_SECRET`, and
   `AUTH_TRUST_HOST=true`; deploy.
4. Open the deployment URL and complete `/setup`.

Document uploads currently expect local disk; wire an object store
(`src/app/dashboard/students/[id]` documents tab) before relying on them in
production.

---

## Project layout

```
src/
  db/schema.ts            all tables (auth, school, calendar, ladder, students,
                          guardians, enrolments, fees, plans, instalments,
                          discounts, payments, allocations)
  lib/
    provision.ts          seeds the Egyptian ladder + defaults for a new school
    session.ts            requireStaff / role checks
    academic.ts           current year, year resolution from ?year=
    fees.ts               bill generation, instalment split, student ledger
    payments.ts           receipt numbers, payment recording + allocation
    reports.ts            dashboard + report aggregations
    students.ts           register queries, balances
    i18n.ts               English / Arabic dictionary + RTL
  app/
    setup/                first-run onboarding
    (auth)/login/
    dashboard/            dashboard, students, admissions, enrollments, fees,
                          payments, reports, settings
    actions/              server actions per area
    api/dev/seed/         demo data (dev only)
```

See **[USAGE.md](USAGE.md)** for a step-by-step walkthrough of running a full
academic year — setup, admissions, fee plans, billing, payments, receipts,
reports, and cohort promotion.
