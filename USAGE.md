# NELS Tracking Sheet — how to use it

A walkthrough of one full academic year, in the order you'd actually do things.
Every screen has an **academic-year picker in the top bar** — it controls which
year everything you see and enter belongs to.

---

## Roles — who can do what

| Role | Students & guardians | Enrolments | Fees & plans | Payments | Settings & staff |
|---|:---:|:---:|:---:|:---:|:---:|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Registrar** | ✅ | ✅ | — | — | — |
| **Accountant** | — | — | ✅ | ✅ | — |
| **Teacher** | read | read | read | read | read |
| **Viewer** | read | read | read | read | read |

Everyone can open every screen; the table above is about *changing* things.

---

## 1. First-time setup

1. Open the app. You're sent to **`/setup`**.
2. Enter the **school name**, a short code (e.g. `NELS`), and your own name,
   email, and password. Pick the **academic year** from the dropdown and adjust
   its **start / end dates** if your calendar isn't September–June.
3. Submit. This creates:
   - the school,
   - **you** as the Owner,
   - the Egyptian grade ladder — KG1, KG2, Primary 1–6, Preparatory 1–3,
     Secondary 1–3,
   - the academic year you chose, split into **Term 1** and **Term 2**,
   - default fee items: Tuition, Registration, Bus, Books, Uniform, Activities,
     Exams.
4. You're logged in on the Dashboard (empty for now).

### Add the rest of your staff

**Settings → Staff → add a person**: name, email, a temporary password, and a
role. Give the finance office **Accountant**, the front office **Registrar**.
They sign in at `/login` and can change their password later.

### Switch to Arabic (optional)

**Settings → School profile → Language → العربية → Save changes.** The whole
interface, including layout direction, switches to Arabic. Student and guardian
names are always shown in Arabic regardless.

---

## 2. Set the fee plans (before you bill anyone)

**Fees & plans.**

1. **Fee items** — the defaults cover most schools. Add more if you need to
   (e.g. "Lab fee", "Graduation") with an Arabic name and a category.
2. **Fee plans** — click a grade chip (e.g. *Primary 1*). Fill in the amount for
   each fee item that applies to that grade this year:
   - **Instalments** (top) — how many parts tuition is split into (commonly 3 or
     4).
   - **Mandatory** — ticked lines are billed to every student. Untick *Bus* if
     only some families use it.
   - **Instalments** column — ticked lines are split across the instalment
     schedule; leave it on for Tuition, off for one-off fees like Registration.
   - Click **Save changes**. A ✓ appears on the grade chip.
3. Repeat for every grade. Grades with the same fees: fill one, then copy the
   numbers across — it's quick.

---

## 3. Register students (Admissions)

**Admissions.** One form does everything:

- **Student** — the four-part Arabic name (first / father's / grandfather's /
  family), the name in English for certificates, national ID (14 digits, or
  leave blank for young KG pupils), gender, date of birth, religion, birth
  governorate, address.
- **Guardian** — name, relation, phone. This person is set as primary and
  emergency contact; add more guardians later from the student's profile.
- **Enrolment (optional)** — tick *Enrol into 2025 / 2026 now* and pick a grade
  to place them straight away. Otherwise they're saved as an **Applicant** and
  you enrol them later.

Save. You land on the student's profile with a generated code like
`NELS-2025-0042`.

### Bulk import from Excel

For a whole class or a fresh year, **Students → Import from Excel**:

1. **Download template (.xlsx)** — it has a `Students` sheet with the column
   headers and one example row, and a `Grades` sheet listing the exact grade
   names to put in the *Grade* column.
2. Fill one row per student. Required: first name, family name, gender, date of
   birth, guardian name, guardian phone. Everything else is optional — leave the
   *Grade* column blank to import students as applicants without enrolling them.
   - Gender accepts `male` / `female` or `ذكر` / `أنثى`; religion accepts
     `muslim` / `christian` / `other` or the Arabic words; dates accept
     `YYYY-MM-DD`, `DD/MM/YYYY`, or Excel date cells.
3. **Upload and preview** — every row is checked and shown with a green *ready*
   or the specific problem ("Date of birth not understood", "Grade not found").
4. **Import N students** — creates the valid rows (student + primary guardian,
   and an enrolment if a grade was given). Rows with errors are skipped; fix them
   in Excel and re-upload to add just those. Students already on file (matched by
   national ID) are skipped, so re-running is safe.

### The student profile

Five tabs:

- **Overview** — personal data and any discounts.
- **Guardians** — all contacts; add more with *Add guardian* (tick *Primary
  contact* to move the primary flag).
- **Enrolment history** — one row per year.
- **Fees & payments** — the student's ledger once bills exist: gross, discount,
  net, paid, remaining, and status per fee item.
- **Documents** — uploaded files.

---

## 4. Enrol students into grades and classes

**Enrolments.**

1. The row of tiles shows how many active students are in each grade this year.
2. **Classes** — create sections: pick a grade, name it `1-A`, `1-B`, set a
   capacity, Save.
3. **Enrol student** — pick a student not yet enrolled this year, a grade, and
   (optionally) a class. Applicants become Enrolled automatically.

### The roster (editing placements)

The roster under the year name is the working view:

- **Filter** by grade, by class (or *Unassigned*), or type a name / code in the
  search box.
- **Edit one student** — click **Edit** on the row. The grade, class, and status
  become dropdowns; the class list narrows to whatever grade you pick. Hit the
  check to save — no page reload. Setting the status to *Withdrawn* also marks
  the student withdrawn.
- **Move a batch** — tick the checkboxes on several rows, pick a class in the
  *Move to…* bar that appears, and click **Move**. Good for sorting a new
  intake into sections.
- From a student's profile, the **Edit** link on their *Enrolment history* tab
  drops you into the roster already filtered to that student.

---

## 5. Generate the bills

**Fees & plans → Generate bills.**

This looks at every actively-enrolled student, finds the fee plan for their
grade, and creates their charges — splitting tuition into the instalments you
configured, applying any discounts. It's **safe to run again**: it only fills in
students who don't have bills yet (new admissions mid-year, for example).

Discounts must be added *before* generating a student's bills — see below.

### Discounts and special cases

**Year-wide discounts** (applied when bills are generated): a percentage or fixed
amount off a fee category (usually *Tuition*), for sibling / staff-child /
hardship cases.

**Adjusting one charge after billing** — on the student's **Fees & payments**
tab, click **Adjust** on any fee row (Accountant / Admin / Owner). Choose:

- **Set exact amount** — this student's tuition is EGP 20,000 instead of 32,000,
- **Discount %** — 25% off this charge,
- **Discount EGP** — 5,000 off this charge,

with a **reason** (kept on the record). The unpaid instalments are recalculated
so the remaining balance matches the new figure; instalments already paid are
left alone. You can't set an amount below what the family has already paid toward
that fee. A charge reduced to zero is marked *Waived*.

---

## 6. Take payments

**Payments → New payment** (or the **Record payment** button on a student's
profile).

1. **Find the student.** The picker searches as you type — name, code, national
   ID, or **guardian phone**. Filter by grade and class, and by default it only
   shows students who owe something, sorted by how much. Click the row.
2. Their open fees are listed. Enter the **amount**, the **method** (Cash,
   InstaPay, Bank transfer, Cheque, Card), and the **date**.
3. Optionally target a specific fee — otherwise the payment fills the
   **oldest-due instalments first**.
4. Submit. A receipt number like `RC-2025-000418` is generated and you land on
   the **printable receipt** (use *Print receipt*, or your browser's print — the
   app chrome is hidden on paper).

The student's ledger, their balance in the register, and the dashboard all
update immediately.

**Payments** lists every receipt for the year with what each one was allocated
to. Click a receipt number to reprint it.

---

## 7. Watch the numbers

**Dashboard** (scoped to the year in the top bar):

- **Fees billed / Collected / Collection rate / Outstanding**, plus overdue
  instalment count.
- **Collections by month** — the cash curve across the school year.
- **Billed by stage** — collected vs billed for KG, Primary, Preparatory,
  Secondary.
- **Recent payments** and **Outstanding by grade**.

**Reports** adds:

- Income by **stage**, by **fee type**, and a full **income-by-grade table**
  (billed / collected / outstanding / collection rate per grade, with a total
  row).
- **Collections by payment method** with percentages — useful for reconciling
  the bank.

To look at a previous year, change the picker in the top bar.

---

## 8. End of year — promote the cohort

Before the new year starts:

1. **Settings → Academic years → add** the next year: its name, start/end dates,
   and how many terms; tick *Make current*. Existing years' names, dates, and
   term dates are editable there too.
2. **Enrolments → Promote cohort** → from `2025 / 2026` to `2026 / 2027`.
   Every active student moves up one grade into the new year. Students finishing
   **Secondary 3** are marked **Graduated**.
3. Set the **fee plans** for the new year (step 2), then **generate bills**
   (step 5).

New siblings and transfers: register them in Admissions and enrol them normally.

---

## Tips

- **The year picker is everything.** If a screen looks empty, check you're on
  the right academic year.
- **Re-running "Generate bills" is safe** and is how you bill students admitted
  after the initial run.
- **A payment with no matching open fee** is recorded as an unallocated credit
  on the student's account and shown in yellow on the receipt; it's applied
  automatically once a bill exists.
- **Balances shown in red** in the student register mean money is owed for the
  selected year.
