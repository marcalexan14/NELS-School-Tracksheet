# NELS Tracking Sheet

A student register and school-fee tracking system for the **Egyptian national
education system** — Kindergarten (KG1) through Thanaweya Amma (Secondary 3).

Built for a single school with multiple staff users. Tracks the full student
database, per-grade fee plans, instalments, receipts, discounts, and income by
academic year, stage, grade, and fee type. English and Arabic (RTL) interface.

---

## What it does

| Area | Details |
|---|---|
| **Students** | Full register: four-part Arabic name + English name, 14-digit national ID, gender, date of birth, birth governorate, religion, nationality, address, photo, status (applicant / enrolled / graduated / withdrawn / transferred). Multiple guardians per student with relation, phones, occupation, primary + emergency contact flags. Document slots (birth certificate, national ID, transfer papers, medical…). |
| **Admissions** | One form registers a student, their first guardian, and (optionally) enrols them into a grade for the current year. |
| **Excel import** | Download a template, fill one row per student, upload — every row is validated and previewed before commit. Matches English/Arabic headers, gender/religion/relation synonyms, several date formats; de-dupes on national ID. Creates student + guardian + optional enrolment. |
| **Academic calendar** | Multiple academic years ("2025 / 2026"), two terms each, one flagged current. The Egyptian grade ladder (KG1–KG2, Primary 1–6, Preparatory 1–3, Secondary 1–3) is seeded and shown in Settings. |
| **Enrolments** | Place students in a grade and class per year. Create classes/sections ("1-A", "1-B"). Edit any placement inline (change grade / class / status). **Promote cohort** moves every active student up one grade into the next year; Secondary 3 students are marked graduated. |
| **Fees** | Named fee items (Tuition, Registration, Bus, Books, Uniform, Activities, Exams…) each in a category. Per-grade, per-year **fee plans** set the amounts, how many instalments tuition splits into, and which lines are mandatory. **Generate bills** creates the charges for every enrolled student who doesn't have them yet (idempotent). |
| **Discounts** | Sibling / staff-child / merit / hardship / early-payment, as a percentage or a fixed amount, optionally limited to one fee category. Applied automatically when bills are generated. |
| **Payments** | Record a payment (cash / InstaPay / bank transfer / cheque / card), auto-allocated across the student's open instalments oldest-due-first, or targeted at one fee. Every payment gets a sequential receipt number and a printable receipt. |
| **Dashboard & reports** | Fees billed, collected, collection rate, outstanding, overdue instalments. Collections by month, billed vs collected by stage, outstanding by grade, income by fee type, income by grade, collections by payment method. Everything scoped to the academic year picked in the top bar. |
| **Staff & roles** | Owner, Admin, Registrar, Accountant, Teacher, Viewer. Registrars manage students and enrolments; accountants manage fees and payments; admins and the owner manage settings and staff; viewers read only. |
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

Creates a demo school ("Nile English Language School"), ~90 students with
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

1. Provision a PostgreSQL database and set `DATABASE_URL`.
2. Set a strong `AUTH_SECRET`.
3. `npm run build` then `npm start` (or deploy to Vercel — it's a standard
   Next.js app; add the two environment variables in the project settings).
4. `npm run db:push` against the production database once.
5. Visit `/setup` to create the school and owner.

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
